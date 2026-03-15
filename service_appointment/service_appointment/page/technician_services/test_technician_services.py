# Copyright (c) 2026, Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import getdate

from service_appointment.service_appointment.page.technician_services import technician_services


class _DummyDoc:
	def __init__(self, **kwargs):
		self.name = kwargs.get("name", "SA-TEST-0001")
		self.docstatus = kwargs.get("docstatus", 0)
		self.appointment_status = kwargs.get("appointment_status", "Scheduled")
		self.start_time = kwargs.get("start_time", "")
		self.end_time = kwargs.get("end_time", "")
		self.actual_duration = kwargs.get("actual_duration", 0)
		self.completed_by = kwargs.get("completed_by", "")
		self.reason_of_incompletion = kwargs.get("reason_of_incompletion", "")
		self.remarks = kwargs.get("remarks", "")
		self.collect_amount = kwargs.get("collect_amount", "No")
		self.modified = kwargs.get("modified", "2026-03-14 00:00:00")
		self._saved = False

	def save(self):
		self._saved = True


class TestTechnicianServices(FrappeTestCase):
	def test_parse_payload_accepts_dict_and_json(self):
		self.assertEqual(technician_services._parse_payload({"a": 1}), {"a": 1})
		self.assertEqual(technician_services._parse_payload('{"a": 1}'), {"a": 1})

		with self.assertRaises(frappe.ValidationError):
			technician_services._parse_payload("[]")

	def test_start_service_sets_in_progress_and_timestamps(self):
		doc = _DummyDoc(start_time="", completed_by="", appointment_status="Scheduled")
		with patch.object(technician_services, "_get_technician_context", return_value=frappe._dict(employee="HR-EMP-0001")):
			with patch.object(technician_services, "_get_owned_appointment_doc", return_value=doc):
				result = technician_services.start_service("SA-TEST-0001", started_at="09:30:00")

		self.assertEqual(doc.appointment_status, "In Progress")
		self.assertEqual(doc.start_time, "09:30:00")
		self.assertEqual(doc.completed_by, "HR-EMP-0001")
		self.assertTrue(doc._saved)
		self.assertEqual(result["appointment_status"], "In Progress")

	def test_start_service_refuses_completed(self):
		doc = _DummyDoc(appointment_status="Completed")
		with patch.object(technician_services, "_get_technician_context", return_value=frappe._dict(employee="HR-EMP-0001")):
			with patch.object(technician_services, "_get_owned_appointment_doc", return_value=doc):
				with self.assertRaises(frappe.ValidationError):
					technician_services.start_service("SA-TEST-0001")

	def test_report_could_not_start_requires_reason_and_sets_reschedule(self):
		doc = _DummyDoc(appointment_status="Scheduled")
		with patch.object(technician_services, "_get_technician_context", return_value=frappe._dict(employee="HR-EMP-0009")):
			with patch.object(technician_services, "_get_owned_appointment_doc", return_value=doc):
				with self.assertRaises(frappe.ValidationError):
					technician_services.report_could_not_start("SA-TEST-0001", "", "No answer")
				result = technician_services.report_could_not_start("SA-TEST-0001", "No Access", "No answer")

		self.assertEqual(doc.appointment_status, "Reschedule")
		self.assertEqual(doc.reason_of_incompletion, "No Access")
		self.assertEqual(doc.remarks, "No answer")
		self.assertEqual(doc.completed_by, "HR-EMP-0009")
		self.assertEqual(result["appointment_status"], "Reschedule")

	def test_complete_service_mobile_defaults_to_completed(self):
		doc = _DummyDoc(appointment_status="In Progress", collect_amount="No")
		payload = {
			"start_time": "10:00:00",
			"end_time": "11:15:00",
			"customer_name": "Test Customer",
			"customer_mobile": "97330000000",
			"used_materials": [],
		}
		with patch.object(technician_services, "_get_technician_context", return_value=frappe._dict(employee="HR-EMP-0002")):
			with patch.object(technician_services, "_get_owned_appointment_doc", return_value=doc):
				with patch.object(technician_services, "_apply_complete_appointment") as apply_mock:
					technician_services.complete_service_mobile("SA-TEST-0001", payload)

		self.assertTrue(apply_mock.called)
		called_kwargs = apply_mock.call_args.kwargs
		self.assertEqual(called_kwargs["appointment_status"], "Completed")
		self.assertEqual(called_kwargs["actual_duration"], 75)

	def test_get_technician_services_groups_today_and_upcoming(self):
		base_date = getdate("2026-03-14")
		overdue_rows = [frappe._dict(name="SA-OD", date=getdate("2026-03-13"))]
		window_rows = [
			frappe._dict(name="SA-TOD", date=base_date),
			frappe._dict(name="SA-UP", date=getdate("2026-03-16")),
		]

		with patch.object(technician_services, "_get_technician_context", return_value=frappe._dict(employee="HR-EMP-0001", employee_name="Test Tech")):
			with patch.object(technician_services, "_get_owned_appointment_names", return_value={"SA-OD", "SA-TOD", "SA-UP"}):
				with patch("service_appointment.service_appointment.page.technician_services.technician_services.frappe.get_all", side_effect=[overdue_rows, window_rows]):
					with patch.object(technician_services, "_get_child_row_maps", return_value=({}, {}, {})):
						with patch.object(
							technician_services,
							"_serialize_appointment_row",
							side_effect=lambda row, *_: {"name": row.name, "date": str(row.date)},
						):
							response = technician_services.get_technician_services(date_from="2026-03-14", days=7)

		self.assertEqual(len(response["overdue"]), 1)
		self.assertEqual(len(response["today"]), 1)
		self.assertEqual(len(response["upcoming"]), 1)
		self.assertEqual(response["today"][0]["name"], "SA-TOD")
