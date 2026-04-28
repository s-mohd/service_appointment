from __future__ import unicode_literals

import json
from collections import defaultdict

import frappe
from frappe import _
from frappe.utils import cint, getdate, get_time
from frappe.utils.data import strip_html
from service_appointment.service_appointment import dispatch


@frappe.whitelist()
def get_daily_appointments(date=None, team=None, appointment_status="Scheduled"):
	"""Return appointments for a day with assignment summary."""
	_ensure_workstation_access(require_write=False)
	date = getdate(date) if date else getdate()

	filters = {
		"date": date,
		"docstatus": ["<", 2],
	}
	if team:
		filters["team"] = team
	if appointment_status and appointment_status != "All":
		filters["appointment_status"] = appointment_status

	appointments = frappe.get_all(
		"Service Appointment",
		filters=filters,
		fields=[
			"name",
			"date",
			"time",
			"duration",
			"team",
			"customer",
			"customer_address",
			"address_display",
			"location",
			"appointment_status",
			"required_members",
			"assignment_locked",
			"assignment_state",
			"assignment_note",
			"modified",
		],
		order_by="time asc, modified desc",
	)

	if not appointments:
		return []

	appointment_names = [row.name for row in appointments]
	assigned_rows = frappe.get_all(
		"Team Member",
		filters={
			"parent": ["in", appointment_names],
			"parenttype": "Service Appointment",
			"parentfield": "assigned_members",
		},
		fields=["parent", "member_name", "idx"],
		order_by="parent asc, idx asc",
	)

	assigned_by_appointment = frappe._dict()
	for row in assigned_rows:
		assigned_by_appointment.setdefault(row.parent, []).append(row.member_name)

	for row in appointments:
		members = assigned_by_appointment.get(row.name, [])
		row.assigned_members = members
		row.assigned_count = len(members)
		row.required_members = cint(row.required_members) or 1
		row.assignment_locked = cint(row.assignment_locked)

	return appointments


@frappe.whitelist()
def get_member_daily_load(date=None, appointment=None, team=None):
	"""Return members with daily assigned services and availability vs selected appointment slot."""
	_ensure_workstation_access(require_write=False)
	date = getdate(date) if date else getdate()

	selected_appointment = None
	if appointment and frappe.db.exists("Service Appointment", appointment):
		selected_appointment = frappe.get_value(
			"Service Appointment",
			appointment,
			["name", "date", "time", "duration", "team", "required_members"],
			as_dict=1,
		)

	selected_team = team or (selected_appointment.team if selected_appointment else None)
	target_start, target_end = _get_slot_bounds(selected_appointment)

	team_name_map, employee_teams_map = _get_team_member_map()
	member_services = _get_member_services_on_date(date)

	candidate_members = set(employee_teams_map.keys()) | set(member_services.keys())
	if appointment:
		for member in _get_assigned_members_for_appointment(appointment):
			candidate_members.add(member)

	if not candidate_members:
		return {
			"selected_team": selected_team,
			"selected_appointment": selected_appointment,
			"members": [],
		}

	employee_name_map = _get_employee_name_map(list(candidate_members))

	rows = []
	for employee in candidate_members:
		team_ids = employee_teams_map.get(employee, [])
		teams = [
			{"team": team_id, "team_name": team_name_map.get(team_id) or team_id}
			for team_id in team_ids
		]
		in_selected_team = 1 if (selected_team and selected_team in team_ids) else 0

		services = sorted(member_services.get(employee, []), key=lambda x: x.get("sort_minutes") or 0)
		has_conflict = 0
		service_rows = []
		for service in services:
			slot_label = service.get("slot_label")
			if target_start is not None and target_end is not None and service.get("appointment") != appointment:
				if _intervals_overlap(
					target_start,
					target_end,
					service.get("start_minutes"),
					service.get("end_minutes"),
				):
					has_conflict = 1
					service["conflict"] = 1
			else:
				service["conflict"] = 0

			service_rows.append(
				{
					"appointment": service.get("appointment"),
					"team": service.get("team"),
					"customer": service.get("customer"),
					"location": service.get("location"),
					"address_text": service.get("address_text"),
					"slot_label": slot_label,
					"conflict": service.get("conflict"),
				}
			)

		rows.append(
			{
				"employee": employee,
				"employee_name": employee_name_map.get(employee) or employee,
				"teams": teams,
				"in_selected_team": in_selected_team,
				"assigned_services": service_rows,
				"assigned_service_count": len(service_rows),
				"has_conflict": has_conflict,
				"slot_status": _get_slot_status(target_start, target_end, has_conflict),
			}
		)

	rows.sort(
		key=lambda d: (
			-d.get("in_selected_team", 0),
			d.get("has_conflict", 0),
			d.get("assigned_service_count", 0),
			(d.get("employee_name") or "").lower(),
		)
	)

	return {
		"selected_team": selected_team,
		"selected_appointment": selected_appointment,
		"members": rows,
	}


@frappe.whitelist()
def get_team_members(team):
	"""Return member employee IDs for a Team."""
	_ensure_workstation_access(require_write=False)
	if not team:
		return []

	members = frappe.get_all(
		"Team Member",
		filters={
			"parent": team,
			"parenttype": "Team",
			"parentfield": "team_members",
		},
		pluck="member_name",
		order_by="idx asc",
	)

	return [m for m in members if m]


@frappe.whitelist()
def assign_appointment_members(appointment, required_members=1, assigned_members=None, expected_modified=None):
	"""Assign or reassign members for a service appointment."""
	_ensure_workstation_access(require_write=True)
	doc = frappe.get_doc("Service Appointment", appointment)
	doc.check_permission("write")

	if doc.docstatus == 2 or doc.appointment_status == "Cancelled":
		frappe.throw(_("Cannot assign members to a cancelled appointment."))

	required_members = cint(required_members) or 1
	if required_members < 1:
		frappe.throw(_("Required Members must be at least 1."))

	if expected_modified and str(doc.modified) != str(expected_modified):
		frappe.throw(
			_(
				"This appointment was updated by another user at {0}. Please refresh and try again."
			).format(doc.modified)
		)

	assigned_members = _parse_assigned_members(assigned_members)
	if len(assigned_members) < required_members:
		frappe.throw(
			_(
				"Assigned members ({0}) cannot be less than Required Members ({1})."
			).format(len(assigned_members), required_members)
		)

	if assigned_members:
		existing_employees = set(
			frappe.get_all("Employee", filters={"name": ["in", assigned_members]}, pluck="name")
		)
		missing = [member for member in assigned_members if member not in existing_employees]
		if missing:
			frappe.throw(_("Invalid Employee(s): {0}").format(", ".join(missing)))

	doc.required_members = required_members
	doc.set("assigned_members", [])
	for member in assigned_members:
		doc.append("assigned_members", {"member_name": member})

	doc.assignment_state = _derive_assignment_state(
		required_members=required_members,
		assigned_count=len(assigned_members),
		locked=doc.assignment_locked,
	)
	doc.assignment_note = _compose_manual_assignment_note(
		required_members=required_members,
		assigned_count=len(assigned_members),
		locked=doc.assignment_locked,
	)
	doc.save()

	return {
		"status": "success",
		"appointment": doc.name,
		"required_members": doc.required_members,
		"assigned_count": len(assigned_members),
		"assignment_state": doc.assignment_state,
		"assignment_locked": cint(doc.assignment_locked),
		"assignment_note": doc.assignment_note,
		"modified": str(doc.modified),
	}


@frappe.whitelist()
def auto_assign_day(date=None, team=None, assignment_state=None, force_recalculate=0):
	_ensure_workstation_access(require_write=True)
	return dispatch.auto_assign_day(
		date=date,
		team=team,
		assignment_state=assignment_state,
		force_recalculate=force_recalculate,
	)


@frappe.whitelist()
def set_assignment_lock(appointment, locked=1):
	_ensure_workstation_access(require_write=True)
	return dispatch.set_assignment_lock(appointment=appointment, locked=locked)


@frappe.whitelist()
def get_best_slots(appointment=None, date=None, context_payload=None, limit=5, preferred_time=None):
	_ensure_workstation_access(require_write=False)
	return dispatch.get_best_slots(
		appointment=appointment,
		date=date,
		context_payload=context_payload,
		limit=limit,
		preferred_time=preferred_time,
	)


@frappe.whitelist()
def apply_slot_and_auto_dispatch(appointment, slot_payload, expected_modified=None, force_recalculate=0):
	_ensure_workstation_access(require_write=True)
	return dispatch.apply_slot_and_auto_dispatch(
		appointment=appointment,
		slot_payload=slot_payload,
		expected_modified=expected_modified,
		force_recalculate=force_recalculate,
	)


@frappe.whitelist()
def auto_dispatch_apply(appointment, force_recalculate=0, source="workstation"):
	_ensure_workstation_access(require_write=True)
	return dispatch.auto_dispatch_apply(
		appointment=appointment,
		force_recalculate=force_recalculate,
		source=source,
	)


@frappe.whitelist()
def apply_best_slot_for_appointment(appointment, date=None, force_recalculate=0):
	_ensure_workstation_access(require_write=True)
	best = dispatch.get_best_slots(appointment=appointment, date=date, limit=1)
	slots = best.get("slots") or []
	if not slots:
		return {
			"status": "error",
			"appointment": appointment,
			"message": _("No best slot was found for this appointment/day."),
		}
	doc = frappe.get_value("Service Appointment", appointment, ["modified"], as_dict=1)
	return dispatch.apply_slot_and_auto_dispatch(
		appointment=appointment,
		slot_payload=slots[0],
		expected_modified=doc.modified if doc else None,
		force_recalculate=force_recalculate,
	)


@frappe.whitelist()
def restore_assignment(appointment, snapshot_payload, expected_modified=None):
	_ensure_workstation_access(require_write=True)
	return dispatch.restore_assignment(
		appointment=appointment,
		snapshot_payload=snapshot_payload,
		expected_modified=expected_modified,
	)


def _parse_assigned_members(assigned_members):
	"""Normalize assigned member payload to unique employee IDs."""
	if not assigned_members:
		return []

	if isinstance(assigned_members, str):
		assigned_members = json.loads(assigned_members)

	if not isinstance(assigned_members, list):
		frappe.throw(_("Assigned Members format is invalid."))

	cleaned = []
	seen = set()
	for row in assigned_members:
		member_name = ""
		if isinstance(row, dict):
			member_name = (row.get("member_name") or row.get("employee") or "").strip()
		elif isinstance(row, str):
			member_name = row.strip()

		if not member_name:
			continue

		if member_name in seen:
			continue

		cleaned.append(member_name)
		seen.add(member_name)

	return cleaned


def _get_team_member_map():
	cache_key = "service_assignment_workstation:team_member_map:v1"
	cached = frappe.cache().get_value(cache_key, shared=True)
	if cached:
		return cached.get("team_name_map", {}), cached.get("employee_teams_map", {})

	teams = frappe.get_all("Team", fields=["name", "team_name"], limit_page_length=0)
	team_name_map = {team.name: team.team_name for team in teams}

	rows = frappe.get_all(
		"Team Member",
		filters={"parenttype": "Team", "parentfield": "team_members"},
		fields=["parent", "member_name", "idx"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)

	employee_teams_map = {}
	for row in rows:
		if not row.member_name:
			continue
		employee_teams_map.setdefault(row.member_name, []).append(row.parent)

	frappe.cache().set_value(
		cache_key,
		{
			"team_name_map": team_name_map,
			"employee_teams_map": employee_teams_map,
		},
		shared=True,
		expires_in_sec=300,
	)

	return team_name_map, employee_teams_map


def _ensure_workstation_access(require_write=False):
	ptype = "write" if require_write else "read"
	if not frappe.has_permission("Service Appointment", ptype=ptype):
		frappe.throw(_("Not permitted"), frappe.PermissionError)


def _get_member_services_on_date(date):
	appointments = frappe.get_all(
		"Service Appointment",
		filters={
			"date": date,
			"docstatus": ["<", 2],
			"appointment_status": ["!=", "Cancelled"],
		},
		fields=["name", "time", "duration", "team", "customer", "location", "address_display", "customer_address"],
		order_by="time asc, modified desc",
		limit_page_length=0,
	)

	if not appointments:
		return defaultdict(list)

	appointment_names = [appt.name for appt in appointments]
	assigned_rows = frappe.get_all(
		"Team Member",
		filters={
			"parent": ["in", appointment_names],
			"parenttype": "Service Appointment",
			"parentfield": "assigned_members",
		},
		fields=["parent", "member_name"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)

	members_by_appointment = defaultdict(list)
	for row in assigned_rows:
		if row.member_name:
			members_by_appointment[row.parent].append(row.member_name)

	member_services = defaultdict(list)
	for appt in appointments:
		start, end = _get_slot_bounds(appt)
		slot_label = _format_slot_label(start, end)

		for member in members_by_appointment.get(appt.name, []):
			member_services[member].append(
				{
					"appointment": appt.name,
					"team": appt.team,
					"customer": appt.customer,
					"location": appt.location,
					"address_text": _clean_address(appt.address_display or appt.customer_address or ""),
					"start_minutes": start,
					"end_minutes": end,
					"sort_minutes": start,
					"slot_label": slot_label,
				}
			)

	return member_services


def _get_assigned_members_for_appointment(appointment):
	rows = frappe.get_all(
		"Team Member",
		filters={
			"parent": appointment,
			"parenttype": "Service Appointment",
			"parentfield": "assigned_members",
		},
		pluck="member_name",
		order_by="idx asc",
	)
	return [row for row in rows if row]


def _clean_address(value):
	if not value:
		return ""
	return " ".join(strip_html(value).split())


def _get_employee_name_map(employee_ids):
	if not employee_ids:
		return {}

	rows = frappe.get_all(
		"Employee",
		filters={"name": ["in", employee_ids]},
		fields=["name", "employee_name"],
		limit_page_length=0,
	)
	return {row.name: row.employee_name for row in rows}


def _get_slot_bounds(doc):
	if not doc or not doc.get("time"):
		return None, None

	start_minutes = _time_to_minutes(doc.get("time"))
	if start_minutes is None:
		return None, None

	duration = cint(doc.get("duration")) or 0
	end_minutes = start_minutes + duration

	return start_minutes, end_minutes


def _time_to_minutes(value):
	if not value:
		return None

	time_obj = get_time(value)
	return (time_obj.hour * 60) + time_obj.minute


def _format_minutes(minutes):
	hours = minutes // 60
	mins = minutes % 60
	return "{:02d}:{:02d}".format(hours, mins)


def _format_slot_label(start, end):
	if start is None:
		return ""
	if end is None:
		return _format_minutes(start)
	return "{}-{}".format(_format_minutes(start), _format_minutes(end))


def _intervals_overlap(a_start, a_end, b_start, b_end):
	if a_start is None or a_end is None or b_start is None or b_end is None:
		return 0
	return 1 if (a_start < b_end and b_start < a_end) else 0


def _get_slot_status(target_start, target_end, has_conflict):
	if target_start is None or target_end is None:
		return "unknown"
	return "busy" if has_conflict else "available"


def _derive_assignment_state(required_members, assigned_count, locked=0):
	if cint(locked):
		return "Manual Locked"
	required_members = max(1, cint(required_members) or 1)
	assigned_count = max(0, cint(assigned_count))
	if assigned_count <= 0:
		return "Unassigned"
	if assigned_count < required_members:
		return "Under Assigned"
	return "Assigned"


def _compose_manual_assignment_note(required_members, assigned_count, locked=0):
	shortage = max(0, cint(required_members) - cint(assigned_count))
	base = _("Manual assignment update")
	if cint(locked):
		base = _("Manual assignment lock enabled")
	return _("{0} | Shortage: {1}").format(base, shortage)
