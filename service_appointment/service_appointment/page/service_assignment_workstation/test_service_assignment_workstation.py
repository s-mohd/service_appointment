# Copyright (c) 2026, Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation import (
	_intervals_overlap,
	_parse_assigned_members,
)


class TestServiceAssignmentWorkstation(FrappeTestCase):
	def test_parse_assigned_members_normalizes_and_deduplicates(self):
		rows = [
			" HR-EMP-0001 ",
			{"employee": "HR-EMP-0002"},
			{"member_name": "HR-EMP-0002"},
			{"member_name": " HR-EMP-0003 "},
			"",
			{},
		]
		self.assertEqual(
			_parse_assigned_members(rows),
			["HR-EMP-0001", "HR-EMP-0002", "HR-EMP-0003"],
		)

	def test_parse_assigned_members_throws_for_invalid_payload(self):
		with self.assertRaises(frappe.ValidationError):
			_parse_assigned_members({"employee": "HR-EMP-0001"})

	def test_intervals_overlap(self):
		self.assertEqual(_intervals_overlap(540, 600, 570, 630), 1)
		self.assertEqual(_intervals_overlap(540, 600, 600, 660), 0)
		self.assertEqual(_intervals_overlap(540, 600, 480, 540), 0)
