from __future__ import unicode_literals

import json
from collections import defaultdict
from urllib.parse import quote_plus

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, getdate, get_time, nowtime, sanitize_html
from frappe.utils.data import strip_html

from service_appointment.service_appointment.doctype.service_appointment.service_appointment import (
	_apply_complete_appointment,
)


@frappe.whitelist()
def get_technician_services(date_from=None, days=7):
	ctx = _get_technician_context(require_write=False)
	base_date = getdate(date_from) if date_from else getdate()
	days = max(cint(days), 1)
	end_date = getdate(add_days(base_date, days))

	owned_names = _get_owned_appointment_names(ctx.employee)
	if not owned_names:
		return {
			"technician": {
				"employee": ctx.employee,
				"employee_name": ctx.employee_name,
				"user": frappe.session.user,
			},
			"date_from": str(base_date),
			"date_to": str(end_date),
			"overdue": [],
			"today": [],
			"upcoming": [],
			"reason_options": _get_reason_options(),
		}

	fields = [
		"name",
		"date",
		"time",
		"duration",
		"team",
		"customer",
		"customer_address",
		"address_display",
		"location",
		"service_type",
		"building_type",
		"appointment_status",
		"required_members",
		"collect_amount",
		"total_amount",
		"mode_of_payment",
		"received_amount",
		"start_time",
		"reached_time",
		"end_time",
		"actual_duration",
		"completed_by",
		"customer_name",
		"customer_mobile",
		"mobile_no",
		"signature",
		"attachment",
		"remarks",
		"reason_of_incompletion",
		"modified",
		"docstatus",
	]

	overdue_rows = frappe.get_all(
		"Service Appointment",
		filters={
			"name": ["in", list(owned_names)],
			"docstatus": ["<", 2],
			"date": ["<", base_date],
			"appointment_status": ["not in", ["Completed", "Cancelled"]],
		},
		fields=fields,
		order_by="date asc, time asc, modified desc",
		limit_page_length=1000,
	)

	window_rows = frappe.get_all(
		"Service Appointment",
		filters={
			"name": ["in", list(owned_names)],
			"docstatus": ["<", 2],
			"date": ["between", [base_date, end_date]],
			"appointment_status": ["!=", "Cancelled"],
		},
		fields=fields,
		order_by="date asc, time asc, modified desc",
		limit_page_length=1000,
	)

	today_rows = []
	upcoming_rows = []
	for row in window_rows:
		if getdate(row.date) == base_date:
			today_rows.append(row)
		else:
			upcoming_rows.append(row)

	all_rows = overdue_rows + today_rows + upcoming_rows
	child_maps = _get_child_row_maps([row.name for row in all_rows])
	if len(child_maps) == 3:
		_assigned_map, _other_map, _material_map = child_maps
		_pest_map = defaultdict(list)
	else:
		_assigned_map, _other_map, _material_map, _pest_map = child_maps

	pest_type_names = set()
	for row in all_rows:
		pest_type_names.update(_pest_map.get(row.name, []))
	pest_type_info_map = _get_pest_type_info_map(pest_type_names)
	for row in all_rows:
		row._pest_types = _pest_map.get(row.name, [])
		row._pest_type_info_map = pest_type_info_map

	overdue = [_serialize_appointment_row(row, _assigned_map, _other_map, _material_map) for row in overdue_rows]
	today = [_serialize_appointment_row(row, _assigned_map, _other_map, _material_map) for row in today_rows]
	upcoming = [_serialize_appointment_row(row, _assigned_map, _other_map, _material_map) for row in upcoming_rows]

	return {
		"technician": {
			"employee": ctx.employee,
			"employee_name": ctx.employee_name,
			"user": frappe.session.user,
		},
		"date_from": str(base_date),
		"date_to": str(end_date),
		"overdue": overdue,
		"today": today,
		"upcoming": upcoming,
		"reason_options": _get_reason_options(),
	}


@frappe.whitelist()
def start_service(appointment, started_at=None):
	ctx = _get_technician_context(require_write=True)
	doc = _get_owned_appointment_doc(appointment, ctx.employee, require_write=True)

	if doc.docstatus != 0:
		frappe.throw(_("Only draft appointments can be started."))

	if doc.appointment_status in ("Completed", "Cancelled", "Partially Completed"):
		frappe.throw(_("Cannot start this appointment in its current status."))

	started_time = _normalize_time(started_at) if started_at else _normalize_time(nowtime())
	if not doc.reached_time:
		frappe.throw(_("Please mark Reached before starting service."))
	if not doc.start_time:
		doc.start_time = _normalize_time(doc.reached_time) or started_time

	doc.appointment_status = "In Progress"
	if not doc.completed_by:
		doc.completed_by = ctx.employee

	doc.save()

	return _action_response(doc)


@frappe.whitelist()
def mark_reached(appointment, reached_at=None):
	ctx = _get_technician_context(require_write=True)
	doc = _get_owned_appointment_doc(appointment, ctx.employee, require_write=True)

	if doc.docstatus != 0:
		frappe.throw(_("Only draft appointments can be updated."))

	if doc.appointment_status in ("Completed", "Cancelled", "Partially Completed", "In Progress"):
		frappe.throw(_("Cannot mark reached for this appointment in its current status."))

	doc.reached_time = _normalize_time(reached_at) if reached_at else _normalize_time(nowtime())
	if not doc.completed_by:
		doc.completed_by = ctx.employee
	doc.save()
	return _action_response(doc)


@frappe.whitelist()
def report_could_not_start(appointment, reason, remarks, status="Reschedule"):
	ctx = _get_technician_context(require_write=True)
	doc = _get_owned_appointment_doc(appointment, ctx.employee, require_write=True)

	reason = (reason or "").strip()
	remarks = (remarks or "").strip()
	if not reason:
		frappe.throw(_("Reason is mandatory."))
	if not remarks:
		frappe.throw(_("Remarks are mandatory."))

	if doc.docstatus != 0:
		frappe.throw(_("Only draft appointments can be updated."))

	if doc.appointment_status in ("Completed", "Cancelled", "Partially Completed"):
		frappe.throw(_("Cannot update this appointment in its current status."))

	status = (status or "Reschedule").strip()
	if status not in ("Reschedule", "Cancelled"):
		frappe.throw(_("Invalid status for Could Not Start."))
	doc.appointment_status = status
	doc.reason_of_incompletion = reason
	doc.remarks = remarks
	doc.completed_by = ctx.employee
	doc.save()

	return _action_response(doc)


@frappe.whitelist()
def complete_service_mobile(appointment, payload):
	ctx = _get_technician_context(require_write=True)
	doc = _get_owned_appointment_doc(appointment, ctx.employee, require_write=True)

	if doc.docstatus != 0:
		frappe.throw(_("Only draft appointments can be completed from Technician Services."))

	payload = _parse_payload(payload)
	status = (
		payload.get("appointment_status")
		or payload.get("status")
		or ("Completed" if doc.appointment_status in ("Scheduled", "In Progress") else doc.appointment_status)
	)
	if status in ("In Progress", "Reschedule", "Cancelled"):
		frappe.throw(_("Please choose Completed or Partially Completed in this dialog."))

	if status == "Completed" and not payload.get("customer_name"):
		frappe.throw(_("Customer Name is mandatory for completed appointments."))
	if status == "Completed" and not payload.get("customer_mobile"):
		frappe.throw(_("Customer Mobile is mandatory for completed appointments."))

	amount_received_flag = payload.get("amount_received")
	received_amount = flt(payload.get("received_amount")) if payload.get("received_amount") else 0
	if status == "Completed" and doc.collect_amount == "Yes" and not amount_received_flag:
		frappe.throw(_("Amount Received field is mandatory."))
	if amount_received_flag == "Yes" and not payload.get("mode_of_payment"):
		frappe.throw(_("Mode of Payment is mandatory when amount is received."))
	if status == "Completed" and amount_received_flag == "Yes" and not received_amount:
		frappe.throw(_("Received Amount is mandatory when amount is received."))
	if amount_received_flag != "Yes":
		received_amount = 0

	used_materials = payload.get("used_materials") or []
	for idx, row in enumerate(used_materials, start=1):
		if not row.get("item"):
			frappe.throw(_("Please select item for used materials in row {0}").format(idx))
		if not row.get("qty"):
			frappe.throw(_("Please select qty for used materials in row {0}").format(idx))
		if not row.get("uom"):
			frappe.throw(_("Please select uom for used materials in row {0}").format(idx))

	start_time = _normalize_time(payload.get("start_time") or doc.start_time or nowtime())
	end_time = _normalize_time(payload.get("end_time") or nowtime())
	actual_duration = cint(payload.get("actual_duration") or payload.get("duration") or _get_duration_minutes(start_time, end_time))

	_apply_complete_appointment(
		doc,
		appointment_status=status,
		reason_of_incompletion=payload.get("reason_of_incompletion") or payload.get("reason"),
		mode_of_payment=payload.get("mode_of_payment"),
		received_amount=received_amount,
		used_materials=used_materials,
		start_time=start_time,
		end_time=end_time,
		actual_duration=actual_duration,
		customer_name=payload.get("customer_name"),
		customer_mobile=payload.get("customer_mobile"),
		signature=payload.get("signature") or payload.get("customer_signature"),
		remarks=payload.get("remarks"),
		attachment=payload.get("attachment"),
		completed_by=payload.get("completed_by") or doc.completed_by or ctx.employee,
		other_members=payload.get("other_members") or [],
	)

	return _action_response(doc)


def _get_technician_context(require_write=False):
	ptype = "write" if require_write else "read"
	if not frappe.has_permission("Service Appointment", ptype=ptype):
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	employee = frappe.db.get_value(
		"Employee",
		{"user_id": frappe.session.user},
		["name", "employee_name"],
		as_dict=1,
	)
	if not employee:
		frappe.throw(_("Your user is not linked to an Employee record."), frappe.PermissionError)

	return frappe._dict(employee=employee.name, employee_name=employee.employee_name)


def _get_owned_appointment_names(employee):
	assigned_rows = frappe.get_all(
		"Team Member",
		filters={
			"member_name": employee,
			"parenttype": "Service Appointment",
			"parentfield": "assigned_members",
		},
		pluck="parent",
	)
	completed_rows = frappe.get_all(
		"Service Appointment",
		filters={"completed_by": employee, "docstatus": ["<", 2]},
		pluck="name",
	)
	return set(assigned_rows + completed_rows)


def _get_owned_appointment_doc(appointment, employee, require_write=False):
	if not frappe.db.exists("Service Appointment", appointment):
		frappe.throw(_("Service Appointment {0} not found.").format(appointment))

	doc = frappe.get_doc("Service Appointment", appointment)
	if require_write:
		doc.check_permission("write")
	else:
		doc.check_permission("read")

	if not _is_owned_by_technician(doc, employee):
		frappe.throw(_("You are not allowed to access this service."), frappe.PermissionError)

	return doc


def _is_owned_by_technician(doc, employee):
	if doc.completed_by == employee:
		return True

	return bool(
		frappe.db.exists(
			"Team Member",
			{
				"member_name": employee,
				"parent": doc.name,
				"parenttype": "Service Appointment",
				"parentfield": "assigned_members",
			},
		)
	)


def _serialize_appointment_row(row, assigned_map, other_map, material_map):
	address_text = _clean_address(row.address_display or row.customer_address or "")
	map_query = (row.location or address_text or "").strip()
	map_url = (
		"https://www.google.com/maps/search/?api=1&query={0}".format(quote_plus(map_query))
		if map_query
		else ""
	)

	assigned_members = assigned_map.get(row.name, [])
	other_members = [{"employee": member} for member in other_map.get(row.name, [])]
	used_materials = material_map.get(row.name, [])
	pest_types = row.get("_pest_types") or []
	pest_type_info_map = row.get("_pest_type_info_map") or {}
	technician_instructions = ""
	safety_measures = ""
	for pest_name in pest_types:
		pest_info = pest_type_info_map.get(pest_name) or {}
		if not technician_instructions and pest_info.get("technician_instructions"):
			technician_instructions = pest_info.get("technician_instructions")
		if not safety_measures and pest_info.get("safety_measures"):
			safety_measures = pest_info.get("safety_measures")
		if technician_instructions and safety_measures:
			break
	has_safety_info = int(bool(_clean_address(technician_instructions) or _clean_address(safety_measures)))

	return {
		"name": row.name,
		"date": str(row.date),
		"time": row.time,
		"duration": row.duration,
		"team": row.team,
		"customer": row.customer,
		"customer_address": row.customer_address,
		"address_text": address_text,
		"location": row.location,
		"map_url": map_url,
		"service_type": row.service_type,
		"building_type": row.building_type,
		"pest_types": pest_types,
		"appointment_status": row.appointment_status,
		"required_members": cint(row.required_members) or 1,
		"assigned_members": assigned_members,
		"assigned_count": len(assigned_members),
		"collect_amount": row.collect_amount,
		"collect_message": _("Collect Amount from customer") if row.collect_amount == "Yes" else _("Don't Collect Amount from customer"),
		"total_amount": row.total_amount,
		"mode_of_payment": row.mode_of_payment,
		"received_amount": row.received_amount,
		"start_time": row.start_time,
		"reached_time": row.reached_time,
		"end_time": row.end_time,
		"actual_duration": row.actual_duration,
		"completed_by": row.completed_by,
		"customer_name": row.customer_name,
		"customer_mobile": row.customer_mobile,
		"mobile_no": row.mobile_no,
		"signature": row.signature,
		"attachment": row.attachment,
		"remarks": row.remarks,
		"reason_of_incompletion": row.reason_of_incompletion,
		"other_members": other_members,
		"used_materials": used_materials,
		"has_safety_info": has_safety_info,
		"is_pending_materials": 1 if row.appointment_status == "Partially Completed" else 0,
		"technician_instructions": technician_instructions,
		"safety_measures": safety_measures,
		"docstatus": row.docstatus,
		"modified": str(row.modified) if row.modified else None,
		"status_color": _status_color(row.appointment_status),
		"can_reach": row.docstatus == 0 and not bool(row.reached_time) and row.appointment_status not in ("Completed", "Cancelled", "In Progress", "Partially Completed"),
		"can_start": row.docstatus == 0 and bool(row.reached_time) and row.appointment_status not in ("Completed", "Cancelled", "In Progress", "Partially Completed"),
		"can_complete": row.docstatus == 0 and row.appointment_status not in ("Completed", "Cancelled"),
		"can_report_no_start": row.docstatus == 0 and row.appointment_status not in ("Completed", "Cancelled", "Partially Completed"),
	}


def _status_color(status):
	if status == "Completed":
		return "green"
	if status == "In Progress":
		return "blue"
	if status == "Partially Completed":
		return "orange"
	if status in ("Reschedule", "Cancelled"):
		return "red"
	return "gray"


def _get_child_row_maps(appointment_names):
	assigned_map = defaultdict(list)
	other_map = defaultdict(list)
	material_map = defaultdict(list)
	pest_map = defaultdict(list)

	if not appointment_names:
		return assigned_map, other_map, material_map, pest_map

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
	for row in assigned_rows:
		if row.member_name:
			assigned_map[row.parent].append(row.member_name)

	other_rows = frappe.get_all(
		"Team Member",
		filters={
			"parent": ["in", appointment_names],
			"parenttype": "Service Appointment",
			"parentfield": "other_members",
		},
		fields=["parent", "member_name", "idx"],
		order_by="parent asc, idx asc",
	)
	for row in other_rows:
		if row.member_name:
			other_map[row.parent].append(row.member_name)

	material_rows = frappe.get_all(
		"Raw Material Item",
		filters={
			"parent": ["in", appointment_names],
			"parenttype": "Service Appointment",
			"parentfield": "used_materials",
		},
		fields=["parent", "item", "uom", "qty", "idx"],
		order_by="parent asc, idx asc",
	)
	for row in material_rows:
		material_map[row.parent].append(
			{
				"item": row.item,
				"uom": row.uom,
				"qty": row.qty,
			}
		)

	pest_rows = frappe.get_all(
		"Pest Type Item",
		filters={
			"parent": ["in", appointment_names],
			"parenttype": "Service Appointment",
			"parentfield": "pest_type",
		},
		fields=["parent", "pest_type", "idx"],
		order_by="parent asc, idx asc",
	)
	for row in pest_rows:
		if row.pest_type:
			pest_map[row.parent].append(row.pest_type)

	return assigned_map, other_map, material_map, pest_map


def _clean_address(value):
	if not value:
		return ""
	return " ".join(strip_html(value).split())


def _normalize_time(value):
	if not value:
		return ""
	return get_time(value).strftime("%H:%M:%S")


def _get_duration_minutes(start_time, end_time):
	if not start_time or not end_time:
		return 0
	start_obj = get_time(start_time)
	end_obj = get_time(end_time)
	start_minutes = (start_obj.hour * 60) + start_obj.minute
	end_minutes = (end_obj.hour * 60) + end_obj.minute
	if end_minutes < start_minutes:
		end_minutes += (24 * 60)
	return max(end_minutes - start_minutes, 0)


def _parse_payload(payload):
	if not payload:
		return {}
	if isinstance(payload, dict):
		return payload
	if isinstance(payload, str):
		try:
			parsed = json.loads(payload)
		except Exception:
			frappe.throw(_("Payload format is invalid."))
		if not isinstance(parsed, dict):
			frappe.throw(_("Payload format is invalid."))
		return parsed

	frappe.throw(_("Payload format is invalid."))


def _get_pest_type_info_map(pest_type_names):
	names = [name for name in (pest_type_names or []) if name]
	if not names:
		return {}

	has_instructions = frappe.db.has_column("Pest Type", "technician_instructions")
	has_safety = frappe.db.has_column("Pest Type", "safety_measures")
	if not has_instructions and not has_safety:
		return {}

	fields = ["name"]
	if has_instructions:
		fields.append("technician_instructions")
	if has_safety:
		fields.append("safety_measures")

	rows = frappe.get_all(
		"Pest Type",
		filters={"name": ["in", names]},
		fields=fields,
		limit_page_length=max(len(names), 20),
	)

	out = {}
	for row in rows:
		instructions = _sanitize_rich_text(row.get("technician_instructions"))
		safety = _sanitize_rich_text(row.get("safety_measures"))
		out[row.name] = {
			"technician_instructions": instructions,
			"safety_measures": safety,
		}
	return out


def _sanitize_rich_text(value):
	html = (value or "").strip()
	if not html:
		return ""
	return sanitize_html(html, linkify=False)


def _get_reason_options():
	if not frappe.db.exists("DocType", "Reason of Incompletion"):
		return []
	return frappe.get_all("Reason of Incompletion", pluck="name", order_by="name asc")


def _action_response(doc):
	return {
		"status": "success",
		"appointment": doc.name,
		"appointment_status": doc.appointment_status,
		"docstatus": doc.docstatus,
		"is_pending_materials": 1 if doc.appointment_status == "Partially Completed" and doc.docstatus == 0 else 0,
		"start_time": doc.start_time,
		"reached_time": doc.reached_time,
		"end_time": doc.end_time,
		"actual_duration": doc.actual_duration,
		"completed_by": doc.completed_by,
		"reason_of_incompletion": doc.reason_of_incompletion,
		"remarks": doc.remarks,
		"modified": str(doc.modified),
	}
