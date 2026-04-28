from __future__ import unicode_literals

import json
from collections import defaultdict

import frappe
from frappe import _
from frappe.utils import cint, getdate, get_time
from frappe.utils.data import strip_html


MATCH_RANK = {"exact": 0, "range": 1, "nearest": 2, "none": 3}


@frappe.whitelist()
def get_best_slots(appointment=None, date=None, context_payload=None, limit=5, preferred_time=None):
	limit = max(1, cint(limit) or 5)
	context = _build_slot_context(
		appointment=appointment,
		date=date,
		context_payload=context_payload,
		preferred_time=preferred_time,
	)
	slots = _rank_best_slots(context=context, limit=limit)
	return {
		"status": "success",
		"date": str(context["date"]),
		"default_duration": cint(context["duration"]) or 75,
		"preferred_time": _minutes_to_time_str(context["preferred_start_minutes"])
		if context.get("preferred_start_minutes") is not None
		else "",
		"slots": slots,
	}


@frappe.whitelist()
def apply_slot_and_auto_dispatch(appointment, slot_payload, expected_modified=None, force_recalculate=0):
	doc = _get_dispatchable_doc(appointment, require_write=True)
	if expected_modified and str(doc.modified) != str(expected_modified):
		frappe.throw(
			_("This appointment was updated by another user at {0}. Please refresh and try again.").format(doc.modified)
		)

	payload = _parse_payload(slot_payload)
	slots_payload = payload.get("slots") if isinstance(payload.get("slots"), list) else []
	normalized_slots = _normalize_slot_payload_rows(slots_payload)
	if normalized_slots:
		slot_date = normalized_slots[0].get("date") or payload.get("date") or doc.date
		slot_time = normalized_slots[0].get("time")
		slot_team = normalized_slots[0].get("team")
		slot_duration = sum([cint(row.get("duration")) or 0 for row in normalized_slots])
	else:
		slot_date = payload.get("date") or doc.date
		slot_time = payload.get("time")
		slot_duration = cint(payload.get("duration")) or 0
		slot_team = (payload.get("team") or "").strip()
	reschedule_reason = (payload.get("reschedule_reason") or "").strip()

	if not slot_date:
		frappe.throw(_("Slot Date is required."))
	if not slot_time:
		frappe.throw(_("Slot Time is required."))
	if slot_duration <= 0:
		frappe.throw(_("Slot Duration must be greater than zero."))
	if not slot_team:
		frappe.throw(_("Slot Team is required."))
	if not frappe.db.exists("Team", slot_team):
		frappe.throw(_("Invalid Team: {0}").format(slot_team))

	doc.date = getdate(slot_date)
	doc.time = slot_time
	doc.duration = slot_duration
	doc.team = slot_team
	doc.start_time = slot_time
	doc.end_time = _minutes_to_time_str(_time_to_minutes(slot_time) + slot_duration)
	doc.actual_duration = slot_duration
	doc.appointment_status = "Scheduled"
	doc.assignment_state = "Suggested"
	if reschedule_reason:
		note = (doc.assignment_note or "").strip()
		reason_line = _("Reschedule Reason: {0}").format(reschedule_reason) or ""
		doc.assignment_note = "{0} | {1}".format(note, reason_line) if note else reason_line
	doc.save()

	dispatch_result = _auto_dispatch_apply_on_doc(
		doc=doc,
		force_recalculate=force_recalculate,
		source="slot_apply",
	)
	dispatch_result["slot_applied"] = {
		"date": str(doc.date),
		"time": doc.time,
		"duration": cint(doc.duration) or 0,
		"team": doc.team,
		"reschedule_reason": reschedule_reason,
		"slots": normalized_slots,
	}
	dispatch_result["expected_modified"] = str(doc.modified)
	return dispatch_result


@frappe.whitelist()
def auto_dispatch_apply(appointment, force_recalculate=0, source="form"):
	doc = _get_dispatchable_doc(appointment, require_write=True)
	return _auto_dispatch_apply_on_doc(doc=doc, force_recalculate=force_recalculate, source=source)


@frappe.whitelist()
def restore_assignment(appointment, snapshot_payload, expected_modified=None):
	doc = _get_dispatchable_doc(appointment, require_write=True)
	if expected_modified and str(doc.modified) != str(expected_modified):
		frappe.throw(
			_("This appointment was updated by another user at {0}. Please refresh and try again.").format(doc.modified)
		)
	payload = _parse_payload(snapshot_payload)

	team = (payload.get("team") or "").strip()
	required_members = max(1, cint(payload.get("required_members")) or 1)
	selected_members = _normalize_member_list(payload.get("selected_members"))
	_validate_members(selected_members)
	if team and not frappe.db.exists("Team", team):
		frappe.throw(_("Invalid Team: {0}").format(team))

	if team:
		doc.team = team
	doc.required_members = required_members
	doc.set("assigned_members", [])
	for member in selected_members:
		doc.append("assigned_members", {"member_name": member})

	doc.assignment_state = payload.get("assignment_state") or _derive_assignment_state(
		required_members=doc.required_members,
		assigned_count=len(selected_members),
		locked=doc.assignment_locked,
	)
	doc.assignment_note = payload.get("assignment_note") or _("Restored previous assignment state.")
	doc.save()
	return {
		"status": "success",
		"appointment": doc.name,
		"team": doc.team,
		"required_members": cint(doc.required_members) or 1,
		"selected_members": selected_members,
		"assignment_state": doc.assignment_state,
		"assignment_note": doc.assignment_note,
		"expected_modified": str(doc.modified),
	}


@frappe.whitelist()
def suggest_auto_assignment(appointment, force_recalculate=0, mark_suggested=0):
	force_recalculate = cint(force_recalculate)
	mark_suggested = cint(mark_suggested)
	doc = _get_dispatchable_doc(appointment, require_write=True)
	suggestion = _build_suggestion(doc, force_recalculate=force_recalculate)

	if mark_suggested and suggestion.get("status") == "ok":
		doc.assignment_state = "Suggested"
		doc.assignment_note = suggestion.get("reason_summary") or ""
		doc.save()
		suggestion["expected_modified"] = str(doc.modified)

	return suggestion


@frappe.whitelist()
def confirm_auto_assignment(appointment, suggestion_payload, expected_modified=None):
	doc = _get_dispatchable_doc(appointment, require_write=True)
	if expected_modified and str(doc.modified) != str(expected_modified):
		frappe.throw(
			_("This appointment was updated by another user at {0}. Please refresh and try again.").format(doc.modified)
		)

	payload = _parse_payload(suggestion_payload)
	force_recalculate = cint(payload.get("force_recalculate"))
	if cint(doc.assignment_locked) and not force_recalculate:
		frappe.throw(_("Assignment is locked for this appointment. Unlock it or force recalculation."))

	team = (payload.get("selected_team") or "").strip()
	if not team:
		frappe.throw(_("Suggested team is missing. Please recalculate suggestion."))
	if not frappe.db.exists("Team", team):
		frappe.throw(_("Invalid Team: {0}").format(team))

	required_members = cint(payload.get("required_members")) or cint(doc.required_members) or 1
	selected_members = _normalize_member_list(payload.get("selected_members"))
	_validate_members(selected_members)

	doc.team = team
	doc.required_members = max(1, required_members)
	doc.set("assigned_members", [])
	for member in selected_members:
		doc.append("assigned_members", {"member_name": member})

	if payload.get("lock_assignment") is not None:
		doc.assignment_locked = 1 if _to_bool(payload.get("lock_assignment")) else 0

	doc.assignment_state = _derive_assignment_state(
		required_members=doc.required_members,
		assigned_count=len(selected_members),
		locked=doc.assignment_locked,
	)
	doc.assignment_note = _compose_assignment_note(
		coverage_match_type=payload.get("coverage_match_type"),
		is_fallback=_to_bool(payload.get("is_fallback")),
		shortage_count=max(doc.required_members - len(selected_members), 0),
		reason_summary=(payload.get("reason_summary") or "").strip(),
	)
	doc.save()

	return {
		"status": "success",
		"appointment": doc.name,
		"team": doc.team,
		"required_members": cint(doc.required_members) or 1,
		"selected_members": selected_members,
		"assignment_state": doc.assignment_state,
		"assignment_locked": cint(doc.assignment_locked),
		"assignment_note": doc.assignment_note,
		"expected_modified": str(doc.modified),
	}


@frappe.whitelist()
def set_assignment_lock(appointment, locked=1):
	doc = _get_dispatchable_doc(appointment, require_write=True)
	locked = 1 if cint(locked) else 0
	doc.assignment_locked = locked
	doc.assignment_state = _derive_assignment_state(
		required_members=cint(doc.required_members) or 1,
		assigned_count=len(_get_assigned_members(doc.name)),
		locked=locked,
	)
	if locked and not (doc.assignment_note or "").strip():
		doc.assignment_note = _("Manual assignment lock enabled.")
	doc.save()
	return {
		"status": "success",
		"appointment": doc.name,
		"assignment_locked": locked,
		"assignment_state": doc.assignment_state,
		"expected_modified": str(doc.modified),
	}


@frappe.whitelist()
def auto_assign_day(date=None, team=None, assignment_state=None, force_recalculate=0):
	_ensure_service_appointment_permission(ptype="write")
	date = getdate(date) if date else getdate()
	force_recalculate = cint(force_recalculate)

	filters = {"date": date, "docstatus": ["<", 2], "appointment_status": ["!=", "Cancelled"]}
	if team:
		filters["team"] = team
	if assignment_state and assignment_state != "All":
		filters["assignment_state"] = assignment_state

	appointments = frappe.get_all(
		"Service Appointment",
		filters=filters,
		fields=["name"],
		order_by="time asc, modified asc",
		limit_page_length=0,
	)

	result = {
		"status": "success",
		"date": str(date),
		"processed": 0,
		"applied": 0,
		"skipped_locked": 0,
		"under_assigned": 0,
		"errors": 0,
		"details": [],
	}

	for row in appointments:
		result["processed"] += 1
		try:
			doc = _get_dispatchable_doc(row.name, require_write=True)
			if cint(doc.assignment_locked) and not force_recalculate:
				result["skipped_locked"] += 1
				result["details"].append({"appointment": row.name, "status": "skipped_locked"})
				continue

			suggestion = _build_suggestion(doc, force_recalculate=force_recalculate)
			if suggestion.get("status") != "ok":
				result["errors"] += 1
				result["details"].append(
					{
						"appointment": row.name,
						"status": suggestion.get("status") or "error",
						"message": suggestion.get("message") or _("Suggestion failed."),
					}
				)
				continue

			confirm_auto_assignment(
				appointment=row.name,
				suggestion_payload=suggestion,
				expected_modified=suggestion.get("expected_modified"),
			)
			result["applied"] += 1
			if cint(suggestion.get("shortage_count")):
				result["under_assigned"] += 1
			result["details"].append(
				{
					"appointment": row.name,
					"status": "applied",
					"team": suggestion.get("selected_team"),
					"assigned_count": len(suggestion.get("selected_members") or []),
					"required_members": suggestion.get("required_members"),
					"is_fallback": cint(suggestion.get("is_fallback")),
				}
			)
		except Exception as exc:
			result["errors"] += 1
			result["details"].append({"appointment": row.name, "status": "error", "message": str(exc)})

	return result


def score_team_candidates(context):
	return _score_team_candidates(context)


def select_members(context, team, required_members):
	return _select_members(context=context, team=team, required_members=required_members)


def _build_suggestion(doc, force_recalculate=0):
	if cint(doc.assignment_locked) and not cint(force_recalculate):
		return {
			"status": "skipped",
			"appointment": doc.name,
			"message": _("Assignment is locked for this appointment."),
			"reason": "locked",
			"assignment_locked": 1,
			"expected_modified": str(doc.modified),
		}

	context = _build_context(doc)
	team_candidates = _score_team_candidates(context)
	if not team_candidates:
		return {
			"status": "error",
			"appointment": doc.name,
			"message": _("No team candidates are available for this appointment."),
			"expected_modified": str(doc.modified),
		}

	selected_team = team_candidates[0]
	required_members = max(1, cint(doc.required_members) or 1)
	member_result = _select_members(context=context, team=selected_team["team"], required_members=required_members)
	selected_members = member_result.get("selected_members") or []
	shortage_count = max(required_members - len(selected_members), 0)
	coverage_match_type = selected_team.get("coverage_match_type") or "none"
	is_fallback = cint(selected_team.get("category", 3) > 0 or coverage_match_type in ("nearest", "none"))

	reason_chunks = []
	reason_chunks.append(_("Team: {0}").format(selected_team.get("team_name") or selected_team.get("team")))
	reason_chunks.append(_("Coverage: {0}").format(coverage_match_type.title()))
	if selected_team.get("availability_ok"):
		reason_chunks.append(_("Slot Availability: Yes"))
	else:
		reason_chunks.append(_("Slot Availability: No"))
	if selected_team.get("has_conflict"):
		reason_chunks.append(_("Team Conflict: Yes"))
	if selected_team.get("compatibility_score"):
		reason_chunks.append(_("Service Compatibility: Preferred"))
	if shortage_count:
		reason_chunks.append(_("Shortage: {0} member(s)").format(shortage_count))
	if is_fallback:
		reason_chunks.append(_("Fallback selection applied"))

	reason_summary = " | ".join(reason_chunks)

	return {
		"status": "ok",
		"appointment": doc.name,
		"expected_modified": str(doc.modified),
		"required_members": required_members,
		"selected_team": selected_team.get("team"),
		"selected_team_name": selected_team.get("team_name"),
		"selected_members": selected_members,
		"selected_member_details": member_result.get("selected_member_details") or [],
		"coverage_match_type": coverage_match_type,
		"is_fallback": is_fallback,
		"shortage_count": shortage_count,
		"is_under_assigned": cint(shortage_count > 0),
		"reason_summary": reason_summary,
		"team_candidate": selected_team,
		"team_candidates": team_candidates[:10],
	}


def _auto_dispatch_apply_on_doc(doc, force_recalculate=0, source="form"):
	force_recalculate = cint(force_recalculate)
	suggestion = _build_suggestion(doc, force_recalculate=force_recalculate)
	if suggestion.get("status") == "skipped":
		return {
			"status": "skipped",
			"appointment": doc.name,
			"message": suggestion.get("message") or _("Assignment skipped."),
			"reason": suggestion.get("reason") or "locked",
			"assignment_locked": cint(doc.assignment_locked),
			"expected_modified": str(doc.modified),
		}
	if suggestion.get("status") != "ok":
		return suggestion

	selected_members = suggestion.get("selected_members") or []
	doc.team = suggestion.get("selected_team")
	doc.required_members = max(1, cint(suggestion.get("required_members")) or cint(doc.required_members) or 1)
	doc.set("assigned_members", [])
	for member in selected_members:
		doc.append("assigned_members", {"member_name": member})

	doc.assignment_state = _derive_assignment_state(
		required_members=doc.required_members,
		assigned_count=len(selected_members),
		locked=doc.assignment_locked,
	)
	doc.assignment_note = _compose_assignment_note(
		coverage_match_type=suggestion.get("coverage_match_type"),
		is_fallback=_to_bool(suggestion.get("is_fallback")),
		shortage_count=max(doc.required_members - len(selected_members), 0),
		reason_summary=(suggestion.get("reason_summary") or "").strip(),
	)
	doc.save()

	return {
		"status": "success",
		"appointment": doc.name,
		"team": doc.team,
		"required_members": cint(doc.required_members) or 1,
		"selected_members": selected_members,
		"assigned_count": len(selected_members),
		"assignment_state": doc.assignment_state,
		"assignment_note": doc.assignment_note,
		"assignment_locked": cint(doc.assignment_locked),
		"coverage_match_type": suggestion.get("coverage_match_type"),
		"is_fallback": cint(suggestion.get("is_fallback")),
		"shortage_count": cint(suggestion.get("shortage_count")),
		"source": source,
		"expected_modified": str(doc.modified),
	}


def _build_slot_context(appointment=None, date=None, context_payload=None, preferred_time=None):
	if appointment:
		doc = _get_dispatchable_doc(appointment, require_write=False)
		slot_date = getdate(date) if date else (getdate(doc.date) if doc.date else None)
		if not slot_date:
			frappe.throw(_("Date is required to suggest best slots."))
		if not doc.customer_address:
			frappe.throw(_("Customer Address is required to suggest best slots."))
		pest_types = [row.pest_type for row in (doc.pest_type or []) if row.pest_type]
		duration = _resolve_default_duration(
			pest_types=pest_types,
			service_type=doc.service_type,
			fallback_duration=cint(doc.duration),
		)
		address_data = _get_address_data(doc.customer_address)
		preferred_start_minutes = _time_to_minutes(preferred_time or doc.time)
		return {
			"appointment": doc.name,
			"date": slot_date,
			"duration": duration,
			"customer_address": doc.customer_address,
			"address_city": (address_data.get("city") or "").strip(),
			"address_block_no": cint(address_data.get("block_no")) or 0,
			"service_type": doc.service_type,
			"pest_types": pest_types,
			"service_items": [row.item for row in (doc.items or []) if row.item],
			"required_members": max(1, cint(doc.required_members) or 1),
			"preferred_start_minutes": preferred_start_minutes,
		}

	payload = _parse_payload(context_payload)
	slot_date = getdate(date or payload.get("date")) if (date or payload.get("date")) else None
	if not slot_date:
		frappe.throw(_("Date is required to suggest best slots."))
	customer_address = (payload.get("customer_address") or "").strip()
	if not customer_address:
		frappe.throw(_("Customer Address is required to suggest best slots."))

	address_data = _get_address_data(customer_address)
	service_type = payload.get("service_type")
	pest_types = _extract_pest_type_names(payload.get("pest_type"))
	duration = _resolve_default_duration(
		pest_types=pest_types,
		service_type=service_type,
		fallback_duration=cint(payload.get("duration")),
	)
	preferred_start_minutes = _time_to_minutes(preferred_time or payload.get("preferred_time") or payload.get("time"))
	service_items = []
	for row in (payload.get("items") or []):
		if isinstance(row, dict) and row.get("item"):
			service_items.append(row.get("item"))

	return {
		"appointment": None,
		"date": slot_date,
		"duration": duration,
		"customer_address": customer_address,
		"address_city": (address_data.get("city") or "").strip(),
		"address_block_no": cint(address_data.get("block_no")) or 0,
		"service_type": service_type,
		"pest_types": pest_types,
		"service_items": service_items,
		"required_members": max(1, cint(payload.get("required_members")) or 1),
		"preferred_start_minutes": preferred_start_minutes,
	}


def _rank_best_slots(context, limit=5):
	if cint(context.get("address_block_no")) <= 0:
		frappe.throw(
			_("Address block is required for slot suggestions. Please set Block No on address {0}.").format(
				context.get("customer_address")
			)
		)

	date = context["date"]
	duration = max(1, cint(context.get("duration")) or 60)
	team_candidates = _get_slot_team_candidates(context)
	if not team_candidates:
		return []

	availability_map = _get_team_availability_map(date)
	team_intervals = _get_team_intervals_on_date(date, context.get("appointment"))
	team_load_map = _get_team_daily_load_map(date, exclude_appointment=context.get("appointment"))
	preferred_start_minutes = context.get("preferred_start_minutes")

	slots = []
	for team_row in team_candidates:
		team = team_row.get("team")
		availability_row = availability_map.get(team)
		if not availability_row:
			continue
		intervals = team_intervals.get(team, [])
		for hour in range(24):
			start_minutes = hour * 60
			end_minutes = start_minutes + duration
			if not _slot_is_available(
				availability_row=availability_row,
				intervals=intervals,
				start_minutes=start_minutes,
				end_minutes=end_minutes,
			):
				continue

			slot = {
				"team": team,
				"team_name": team_row.get("team_name") or team,
				"date": str(date),
				"time": _minutes_to_time_str(start_minutes),
				"duration": duration,
				"start_minutes": start_minutes,
				"end_minutes": end_minutes,
				"coverage_match_type": team_row.get("coverage_match_type"),
				"coverage_distance": team_row.get("coverage_distance"),
				"is_fallback": cint(team_row.get("coverage_match_type") in ("nearest", "none")),
				"team_load": cint(team_load_map.get(team)),
				"conflict": 0,
				"time_distance": _slot_time_distance(start_minutes, preferred_start_minutes),
			}
			slots.append(slot)

	slots.sort(
		key=lambda row: (
			MATCH_RANK.get(row.get("coverage_match_type") or "none", 3),
			cint(row.get("coverage_distance")) if row.get("coverage_distance") is not None else 99999,
			cint(row.get("is_fallback")),
			cint(row.get("time_distance")) if row.get("time_distance") is not None else 99999,
			cint(row.get("team_load")),
			cint(row.get("start_minutes")),
			(row.get("team_name") or "").lower(),
		)
	)
	return slots[: max(1, cint(limit) or 5)]


def _get_slot_team_candidates(context):
	teams = frappe.get_all("Team", fields=["name", "team_name"], order_by="name asc", limit_page_length=0)
	if not teams:
		return []

	coverage_rows = frappe.get_all(
		"Team Coverage Block",
		filters={"parenttype": "Team", "parentfield": "coverage_blocks"},
		fields=["parent", "city", "block_from", "block_to", "priority", "active"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)
	coverage_by_team = defaultdict(list)
	for row in coverage_rows:
		if cint(row.active):
			coverage_by_team[row.parent].append(row)

	service_rows = frappe.get_all(
		"Team Service",
		filters={"parenttype": "Team", "parentfield": "team_services"},
		fields=["parent", "item"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)
	services_by_team = defaultdict(set)
	for row in service_rows:
		if row.item:
			services_by_team[row.parent].add(row.item)

	context_items = set(context.get("service_items") or [])
	out = []
	for team in teams:
		coverage = _evaluate_team_coverage(
			target_block=context["address_block_no"],
			target_city=context.get("address_city"),
			rows=coverage_by_team.get(team.name, []),
		)
		coverage_match_type = coverage.get("match_type") or "none"
		out.append(
			{
				"team": team.name,
				"team_name": team.team_name or team.name,
				"coverage_match_type": coverage_match_type,
				"coverage_distance": cint(coverage.get("distance"))
				if coverage.get("distance") is not None
				else 99999,
				"compatibility_score": cint(
					_is_team_service_compatible(
						team_services=services_by_team.get(team.name, set()),
						context_items=context_items,
						service_type=context.get("service_type"),
					)
				),
			}
		)

	out.sort(
		key=lambda row: (
			MATCH_RANK.get(row.get("coverage_match_type") or "none", 3),
			cint(row.get("coverage_distance")) if row.get("coverage_distance") is not None else 99999,
			-cint(row.get("compatibility_score")),
			(row.get("team_name") or "").lower(),
		)
	)
	return out


def _build_context(doc):
	if not doc.date:
		frappe.throw(_("Appointment Date is required for auto assignment."))
	if not doc.time:
		frappe.throw(_("Appointment Time is required for auto assignment."))
	duration = cint(doc.duration) or 0
	if duration <= 0:
		frappe.throw(_("Appointment Duration must be greater than zero for auto assignment."))
	if not doc.customer_address:
		frappe.throw(_("Customer Address is required for auto assignment."))

	address_data = _get_address_data(doc.customer_address)
	block_no = cint(address_data.get("block_no"))
	if block_no <= 0:
		frappe.throw(
			_(
				"Address block is required for auto assignment. Please set Block No on address {0}."
			).format(doc.customer_address)
		)

	start_minutes = _time_to_minutes(doc.time)
	end_minutes = start_minutes + duration

	return {
		"appointment": doc.name,
		"date": getdate(doc.date),
		"time": doc.time,
		"duration": duration,
		"start_minutes": start_minutes,
		"end_minutes": end_minutes,
		"team": doc.team,
		"service_type": doc.service_type,
		"service_items": [row.item for row in (doc.items or []) if row.item],
		"required_members": max(1, cint(doc.required_members) or 1),
		"address_name": doc.customer_address,
		"address_city": (address_data.get("city") or "").strip(),
		"address_block_no": block_no,
	}


def _score_team_candidates(context):
	teams = frappe.get_all("Team", fields=["name", "team_name"], order_by="name asc", limit_page_length=0)
	if not teams:
		return []

	coverage_rows = frappe.get_all(
		"Team Coverage Block",
		filters={"parenttype": "Team", "parentfield": "coverage_blocks"},
		fields=["parent", "city", "block_from", "block_to", "priority", "active"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)
	coverage_by_team = defaultdict(list)
	for row in coverage_rows:
		if not cint(row.active):
			continue
		coverage_by_team[row.parent].append(row)

	service_rows = frappe.get_all(
		"Team Service",
		filters={"parenttype": "Team", "parentfield": "team_services"},
		fields=["parent", "item"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)
	services_by_team = defaultdict(set)
	for row in service_rows:
		if row.item:
			services_by_team[row.parent].add(row.item)

	availability_map = _get_team_availability_map(context["date"])
	team_intervals = _get_team_intervals_on_date(context["date"], context["appointment"])
	context_service_items = set(context.get("service_items") or [])

	candidates = []
	for team in teams:
		coverage = _evaluate_team_coverage(
			target_block=context["address_block_no"],
			target_city=context.get("address_city"),
			rows=coverage_by_team.get(team.name, []),
		)
		availability_ok = _team_has_slot_availability(
			availability_row=availability_map.get(team.name),
			start_minutes=context["start_minutes"],
			end_minutes=context["end_minutes"],
		)
		has_conflict = _team_has_conflict(
			intervals=team_intervals.get(team.name, []),
			start_minutes=context["start_minutes"],
			end_minutes=context["end_minutes"],
		)
		compatible = _is_team_service_compatible(
			team_services=services_by_team.get(team.name, set()),
			context_items=context_service_items,
			service_type=context.get("service_type"),
		)

		coverage_match_type = coverage.get("match_type") or "none"
		coverage_rank = MATCH_RANK.get(coverage_match_type, 3)
		distance = cint(coverage.get("distance")) if coverage.get("distance") is not None else 99999
		priority = cint(coverage.get("priority")) or 10

		if availability_ok and not has_conflict and coverage_rank <= 1:
			category = 0
		elif availability_ok and not has_conflict:
			category = 1
		elif coverage_rank <= 1:
			category = 2
		else:
			category = 3

		candidates.append(
			{
				"team": team.name,
				"team_name": team.team_name or team.name,
				"coverage_match_type": coverage_match_type,
				"coverage_distance": distance,
				"coverage_priority": priority,
				"availability_ok": cint(availability_ok),
				"has_conflict": cint(has_conflict),
				"compatibility_score": cint(compatible),
				"category": category,
			}
		)

	candidates.sort(
		key=lambda row: (
			row.get("category", 3),
			MATCH_RANK.get(row.get("coverage_match_type") or "none", 3),
			cint(row.get("coverage_distance")) if row.get("coverage_distance") is not None else 99999,
			-cint(row.get("compatibility_score")),
			cint(row.get("coverage_priority")) or 10,
			(row.get("team_name") or "").lower(),
		)
	)
	return candidates


def _select_members(context, team, required_members):
	required_members = max(1, cint(required_members) or 1)
	team_member_rows = frappe.get_all(
		"Team Member",
		filters={"parenttype": "Team", "parentfield": "team_members"},
		fields=["parent", "member_name", "idx"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)
	team_members_map = defaultdict(list)
	all_members = []
	for row in team_member_rows:
		member = (row.member_name or "").strip()
		if not member:
			continue
		team_members_map[row.parent].append(member)
		if member not in all_members:
			all_members.append(member)

	selected_team_members = [m for m in team_members_map.get(team, []) if m]
	other_members = [m for m in all_members if m not in selected_team_members]
	candidate_order = selected_team_members + other_members

	member_services = _get_member_services_on_date(
		date=context["date"],
		exclude_appointment=context["appointment"],
	)
	employee_name_map = _get_employee_name_map(candidate_order)

	member_rows = []
	for member in candidate_order:
		services = member_services.get(member, [])
		has_conflict = any(
			_intervals_overlap(context["start_minutes"], context["end_minutes"], s["start_minutes"], s["end_minutes"])
			for s in services
		)
		member_rows.append(
			{
				"employee": member,
				"employee_name": employee_name_map.get(member) or member,
				"in_selected_team": cint(member in selected_team_members),
				"daily_count": len(services),
				"proximity_distance": _member_proximity_distance(
					services=services,
					target_start=context["start_minutes"],
					target_block=context["address_block_no"],
				),
				"has_conflict": cint(has_conflict),
			}
		)

	def _member_key(row):
		return (
			cint(row.get("daily_count")),
			cint(row.get("proximity_distance")) if row.get("proximity_distance") is not None else 99999,
			(row.get("employee_name") or "").lower(),
		)

	team_pool = sorted(
		[row for row in member_rows if row.get("in_selected_team") and not row.get("has_conflict")],
		key=_member_key,
	)
	other_pool = sorted(
		[row for row in member_rows if not row.get("in_selected_team") and not row.get("has_conflict")],
		key=_member_key,
	)
	selected_rows = (team_pool + other_pool)[:required_members]
	selected_members = [row["employee"] for row in selected_rows]
	shortage_count = max(required_members - len(selected_members), 0)

	return {
		"selected_members": selected_members,
		"selected_member_details": selected_rows,
		"candidate_details": member_rows,
		"shortage_count": shortage_count,
	}


def _get_member_services_on_date(date, exclude_appointment=None):
	appointments = frappe.get_all(
		"Service Appointment",
		filters={"date": date, "docstatus": ["<", 2], "appointment_status": ["!=", "Cancelled"]},
		fields=["name", "time", "duration", "customer_address"],
		limit_page_length=0,
		order_by="time asc",
	)
	if not appointments:
		return defaultdict(list)

	address_names = [row.customer_address for row in appointments if row.customer_address]
	address_map = _get_address_block_map(address_names)

	appointment_map = {}
	for row in appointments:
		if row.name == exclude_appointment:
			continue
		start_minutes = _time_to_minutes(row.time) if row.time else None
		if start_minutes is None:
			continue
		duration = cint(row.duration) or 0
		appointment_map[row.name] = {
			"start_minutes": start_minutes,
			"end_minutes": start_minutes + duration,
			"block_no": address_map.get(row.customer_address),
		}

	if not appointment_map:
		return defaultdict(list)

	member_rows = frappe.get_all(
		"Team Member",
		filters={
			"parenttype": "Service Appointment",
			"parentfield": "assigned_members",
			"parent": ["in", list(appointment_map.keys())],
		},
		fields=["parent", "member_name"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	)
	member_services = defaultdict(list)
	for row in member_rows:
		member = (row.member_name or "").strip()
		if not member:
			continue
		appt = appointment_map.get(row.parent)
		if not appt:
			continue
		member_services[member].append(
			{
				"appointment": row.parent,
				"start_minutes": appt["start_minutes"],
				"end_minutes": appt["end_minutes"],
				"block_no": appt["block_no"],
			}
		)
	return member_services


def _get_team_availability_map(date):
	fields = ["team"] + ["hour_{:02d}".format(hour) for hour in range(24)]
	rows = frappe.get_all(
		"Service Team Availability",
		filters={"date": date},
		fields=fields,
		limit_page_length=0,
	)
	return {row.team: row for row in rows}


def _get_team_intervals_on_date(date, exclude_appointment):
	rows = frappe.get_all(
		"Service Appointment",
		filters={"date": date, "docstatus": ["<", 2], "appointment_status": ["!=", "Cancelled"]},
		fields=["name", "team", "time", "duration"],
		limit_page_length=0,
	)
	intervals = defaultdict(list)
	for row in rows:
		if row.name == exclude_appointment:
			continue
		if not row.team or not row.time:
			continue
		start_minutes = _time_to_minutes(row.time)
		if start_minutes is None:
			continue
		duration = cint(row.duration) or 0
		intervals[row.team].append({"start_minutes": start_minutes, "end_minutes": start_minutes + duration})
	return intervals


def _evaluate_team_coverage(target_block, target_city, rows):
	if not rows:
		return {"match_type": "none", "distance": None, "priority": 10}

	city = (target_city or "").strip().lower()

	def _city_allowed(row):
		row_city = (row.city or "").strip().lower()
		return not row_city or not city or row_city == city

	filtered = [row for row in rows if _city_allowed(row)]
	candidates = filtered if filtered else rows

	best = None
	for row in candidates:
		block_from = cint(row.block_from)
		block_to = cint(row.block_to) or block_from
		if block_from <= 0 and block_to <= 0:
			continue
		if block_from > block_to:
			block_from, block_to = block_to, block_from

		if block_from <= target_block <= block_to:
			match_type = "exact" if block_from == block_to == target_block else "range"
			distance = 0
		else:
			match_type = "nearest"
			distance = min(abs(target_block - block_from), abs(target_block - block_to))
		priority = cint(row.priority) or 10
		candidate = {
			"match_type": match_type,
			"distance": distance,
			"priority": priority,
		}
		if not best:
			best = candidate
			continue
		if _coverage_sort_key(candidate) < _coverage_sort_key(best):
			best = candidate

	return best or {"match_type": "none", "distance": None, "priority": 10}


def _coverage_sort_key(candidate):
	return (
		MATCH_RANK.get(candidate.get("match_type") or "none", 3),
		cint(candidate.get("distance")) if candidate.get("distance") is not None else 99999,
		cint(candidate.get("priority")) or 10,
	)


def _is_team_service_compatible(team_services, context_items, service_type):
	team_services = team_services or set()
	context_items = context_items or set()
	if not team_services:
		return 0
	if context_items and (team_services & context_items):
		return 1
	if service_type and service_type in team_services:
		return 1
	return 0


def _team_has_slot_availability(availability_row, start_minutes, end_minutes):
	if not availability_row:
		return False
	for hour in _hours_covered(start_minutes, end_minutes):
		if not cint(availability_row.get("hour_{:02d}".format(hour))):
			return False
	return True


def _hours_covered(start_minutes, end_minutes):
	if start_minutes is None or end_minutes is None or end_minutes <= start_minutes:
		return []
	start_hour = start_minutes // 60
	end_hour = max(end_minutes - 1, start_minutes) // 60
	return range(start_hour, end_hour + 1)


def _slot_is_available(availability_row, intervals, start_minutes, end_minutes):
	if not availability_row:
		return False
	for hour in _hours_covered(start_minutes, end_minutes):
		if not cint(availability_row.get("hour_{:02d}".format(hour))):
			return False
	for row in intervals or []:
		if _intervals_overlap(start_minutes, end_minutes, row.get("start_minutes"), row.get("end_minutes")):
			return False
	return True


def _team_has_conflict(intervals, start_minutes, end_minutes):
	for row in intervals or []:
		if _intervals_overlap(start_minutes, end_minutes, row.get("start_minutes"), row.get("end_minutes")):
			return True
	return False


def _member_proximity_distance(services, target_start, target_block):
	if not services:
		return 99999
	candidates = []
	for row in services:
		block_no = cint(row.get("block_no")) if row.get("block_no") else None
		start_minutes = cint(row.get("start_minutes")) if row.get("start_minutes") is not None else None
		if start_minutes is None:
			continue
		block_distance = abs(target_block - block_no) if block_no else 99998
		time_distance = abs(start_minutes - target_start)
		candidates.append((time_distance, block_distance))
	if not candidates:
		return 99999
	candidates.sort()
	return candidates[0][1]


def _resolve_default_duration(pest_types=None, service_type=None, fallback_duration=0):
	pest_default = _get_pest_type_default_duration(pest_types or [])
	if pest_default > 0:
		return pest_default
	service_default = _get_service_type_default_duration(service_type)
	if service_default > 0:
		return service_default
	duration = cint(fallback_duration) or 0
	if duration > 0:
		return duration
	return 75


def _slot_time_distance(start_minutes, preferred_start_minutes):
	if start_minutes is None:
		return 99999
	if preferred_start_minutes is None:
		return 0
	return abs(cint(start_minutes) - cint(preferred_start_minutes))


def _get_service_type_default_duration(service_type):
	if not service_type:
		return 0
	meta = frappe.get_meta("Service Type")
	if not meta.has_field("default_duration"):
		return 0
	value = frappe.db.get_value("Service Type", service_type, "default_duration")
	return cint(value) or 0


def _get_pest_type_default_duration(pest_types):
	names = [name for name in (pest_types or []) if name]
	if not names:
		return 0
	meta = frappe.get_meta("Pest Type")
	if not meta.has_field("default_duration"):
		return 0
	rows = frappe.get_all(
		"Pest Type",
		filters={"name": ["in", names]},
		fields=["name", "default_duration"],
		limit_page_length=max(20, len(names)),
	)
	max_duration = 0
	for row in rows:
		max_duration = max(max_duration, cint(row.default_duration) or 0)
	return max_duration


def _extract_pest_type_names(payload_rows):
	names = []
	if not payload_rows:
		return names
	for row in payload_rows:
		if isinstance(row, str):
			if row.strip():
				names.append(row.strip())
			continue
		if isinstance(row, dict) and row.get("pest_type"):
			names.append((row.get("pest_type") or "").strip())
	return [name for name in names if name]


def _normalize_slot_payload_rows(rows):
	if not rows:
		return []
	rows = sorted(
		[row for row in rows if isinstance(row, dict)],
		key=lambda row: _time_to_minutes(row.get("time")) or -1,
	)
	out = []
	for idx, row in enumerate(rows, start=1):
		if not isinstance(row, dict):
			frappe.throw(_("Selected slot row #{0} is invalid.").format(idx))
		slot_date = row.get("date")
		slot_time = row.get("time")
		slot_duration = cint(row.get("duration")) or 0
		slot_team = (row.get("team") or "").strip()
		if not slot_date or not slot_time or slot_duration <= 0 or not slot_team:
			frappe.throw(_("Selected slot row #{0} is incomplete.").format(idx))

		start_minutes = _time_to_minutes(slot_time)
		out.append(
			{
				"date": str(slot_date),
				"time": _minutes_to_time_str(start_minutes),
				"duration": slot_duration,
				"team": slot_team,
			}
		)
	return out


def _minutes_to_time_str(minutes):
	minutes = max(0, cint(minutes))
	hours = (minutes // 60) % 24
	mins = minutes % 60
	return "{:02d}:{:02d}:00".format(hours, mins)


def _get_team_daily_load_map(date, exclude_appointment=None):
	rows = frappe.get_all(
		"Service Appointment",
		filters={"date": date, "docstatus": ["<", 2], "appointment_status": ["!=", "Cancelled"]},
		fields=["name", "team"],
		limit_page_length=0,
	)
	load_map = defaultdict(int)
	for row in rows:
		if row.name == exclude_appointment:
			continue
		if row.team:
			load_map[row.team] += 1
	return load_map


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


def _compose_assignment_note(coverage_match_type=None, is_fallback=0, shortage_count=0, reason_summary=""):
	coverage_label = (coverage_match_type or "none").title()
	fallback_label = _("Yes") if cint(is_fallback) else _("No")
	shortage = max(0, cint(shortage_count))
	base = _("Coverage: {0} | Fallback: {1} | Shortage: {2}").format(coverage_label, fallback_label, shortage)
	if reason_summary:
		return "{0} | {1}".format(base, reason_summary)
	return base


def _normalize_member_list(rows):
	if not rows:
		return []
	if isinstance(rows, str):
		rows = json.loads(rows)
	if not isinstance(rows, list):
		frappe.throw(_("Selected Members format is invalid."))

	out = []
	seen = set()
	for row in rows:
		member = ""
		if isinstance(row, dict):
			member = (row.get("member_name") or row.get("employee") or "").strip()
		else:
			member = (row or "").strip()
		if not member or member in seen:
			continue
		out.append(member)
		seen.add(member)
	return out


def _parse_payload(payload):
	if not payload:
		return {}
	if isinstance(payload, dict):
		return payload
	try:
		decoded = json.loads(payload)
	except Exception:
		frappe.throw(_("Suggestion payload must be valid JSON."))
	if not isinstance(decoded, dict):
		frappe.throw(_("Suggestion payload must be an object."))
	return decoded


def _validate_members(members):
	if not members:
		return
	existing = set(frappe.get_all("Employee", filters={"name": ["in", members]}, pluck="name"))
	missing = [member for member in members if member not in existing]
	if missing:
		frappe.throw(_("Invalid Employee(s): {0}").format(", ".join(missing)))


def _get_assigned_members(appointment):
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


def _get_address_data(address_name):
	fields = ["name", "city"]
	block_field = _get_address_block_field()
	if block_field:
		fields.append(block_field)
	row = frappe.db.get_value("Address", address_name, fields, as_dict=1)
	if not row:
		frappe.throw(_("Address not found: {0}").format(address_name))
	row["block_no"] = row.get(block_field) if block_field else None
	return row


def _get_address_block_map(address_names):
	address_names = [name for name in (address_names or []) if name]
	if not address_names:
		return {}

	block_field = _get_address_block_field()
	fields = ["name"]
	if block_field:
		fields.append(block_field)
	rows = frappe.get_all(
		"Address",
		filters={"name": ["in", list(set(address_names))]},
		fields=fields,
		limit_page_length=0,
	)
	block_map = {}
	for row in rows:
		block_value = row.get(block_field) if block_field else None
		block_map[row.name] = cint(block_value) if block_value else None
	return block_map


def _get_address_block_field():
	meta = frappe.get_meta("Address")
	if meta.has_field("block_no"):
		return "block_no"
	if meta.has_field("block"):
		return "block"
	return None


def _get_employee_name_map(employee_ids):
	employee_ids = [row for row in (employee_ids or []) if row]
	if not employee_ids:
		return {}
	rows = frappe.get_all(
		"Employee",
		filters={"name": ["in", list(set(employee_ids))]},
		fields=["name", "employee_name"],
		limit_page_length=0,
	)
	return {row.name: row.employee_name for row in rows}


def _get_dispatchable_doc(appointment, require_write=False):
	_ensure_service_appointment_permission(ptype="write" if require_write else "read")
	doc = frappe.get_doc("Service Appointment", appointment)
	doc.check_permission("write" if require_write else "read")
	if doc.docstatus == 2 or doc.appointment_status == "Cancelled":
		frappe.throw(_("Cannot auto-assign a cancelled appointment."))
	return doc


def _ensure_service_appointment_permission(ptype="read"):
	if not frappe.has_permission("Service Appointment", ptype=ptype):
		frappe.throw(_("Not permitted"), frappe.PermissionError)


def _to_bool(value):
	if isinstance(value, bool):
		return value
	if isinstance(value, (int, float)):
		return value != 0
	value = (value or "").strip().lower()
	return value in {"1", "y", "yes", "true"}


def _time_to_minutes(value):
	if not value:
		return None
	t = get_time(value)
	return (t.hour * 60) + t.minute


def _intervals_overlap(a_start, a_end, b_start, b_end):
	if a_start is None or a_end is None or b_start is None or b_end is None:
		return 0
	return 1 if (a_start < b_end and b_start < a_end) else 0


def clean_address(value):
	if not value:
		return ""
	return " ".join(strip_html(value).split())
