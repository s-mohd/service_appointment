# -*- coding: utf-8 -*-
# Copyright (c) 2020, Sayed Hameed Ebrahim and Contributors
# See license.txt
from __future__ import unicode_literals

import unittest
import frappe

from service_appointment.service_appointment.doctype.service_appointment.service_appointment import (
	ServiceAppointment,
	_apply_complete_appointment,
)


class _DummyCompletionDoc:
	def __init__(self):
		self.name = "SA-TEST-0001"
		self.appointment_status = "Scheduled"
		self.mode_of_payment = ""
		self.received_amount = 0
		self.used_materials = []
		self.start_time = ""
		self.end_time = ""
		self.actual_duration = 0
		self.customer_name = ""
		self.customer_mobile = ""
		self.signature = ""
		self.remarks = ""
		self.attachment = ""
		self.completed_by = ""
		self.reason_of_incompletion = ""
		self.other_members = []
		self.service_contract = ""
		self.docstatus = 0
		self.status = ""
		self._saved = False
		self._submitted = False

	def set(self, fieldname, value):
		if fieldname in ("used_materials", "other_members"):
			setattr(self, fieldname, list(value or []))
			return
		setattr(self, fieldname, value)

	def append(self, fieldname):
		row = frappe._dict()
		getattr(self, fieldname).append(row)
		return row

	def save(self):
		self._saved = True

	def submit(self):
		self._submitted = True

class TestServiceAppointment(unittest.TestCase):
	def test_apply_complete_appointment_partially_completed_saves_draft(self):
		doc = _DummyCompletionDoc()
		_apply_complete_appointment(
			doc,
			appointment_status="Partially Completed",
			used_materials=[{"item": "ITEM-1", "uom": "Nos", "qty": 2}],
			start_time="10:00:00",
			end_time="11:00:00",
			actual_duration=60,
			completed_by="HR-EMP-0001",
			other_members=[{"employee": "HR-EMP-0002"}],
		)
		self.assertTrue(doc._saved)
		self.assertFalse(doc._submitted)
		self.assertEqual(doc.docstatus, 0)
		self.assertEqual(doc.appointment_status, "Partially Completed")
		self.assertEqual(len(doc.used_materials), 1)
		self.assertEqual(len(doc.other_members), 1)

	def test_apply_complete_appointment_completed_submits(self):
		doc = _DummyCompletionDoc()
		_apply_complete_appointment(
			doc,
			appointment_status="Completed",
			used_materials=[],
			start_time="10:00:00",
			end_time="10:30:00",
			actual_duration=30,
			completed_by="HR-EMP-0001",
		)
		self.assertTrue(doc._submitted)
		self.assertFalse(doc._saved)
		self.assertEqual(doc.appointment_status, "Completed")

	def test_on_submit_rejects_partially_completed_status(self):
		dummy = frappe._dict(appointment_status="Partially Completed")
		with self.assertRaises(frappe.ValidationError):
			ServiceAppointment.on_submit(dummy)
