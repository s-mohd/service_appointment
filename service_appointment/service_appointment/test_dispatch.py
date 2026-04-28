# Copyright (c) 2026, Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from service_appointment.service_appointment import dispatch


class TestDispatch(FrappeTestCase):
	def test_coverage_scoring_prefers_exact_then_range_then_nearest(self):
		rows = [
			frappe._dict(city="Manama", block_from=500, block_to=500, priority=20),
			frappe._dict(city="Manama", block_from=490, block_to=510, priority=10),
			frappe._dict(city="Manama", block_from=530, block_to=530, priority=1),
		]
		exact = dispatch._evaluate_team_coverage(target_block=500, target_city="Manama", rows=rows)
		ranged = dispatch._evaluate_team_coverage(target_block=505, target_city="Manama", rows=rows)
		nearest = dispatch._evaluate_team_coverage(target_block=520, target_city="Manama", rows=rows)

		self.assertEqual(exact.get("match_type"), "exact")
		self.assertEqual(ranged.get("match_type"), "range")
		self.assertEqual(nearest.get("match_type"), "nearest")

	def test_nearest_distance_works_for_numeric_blocks(self):
		rows = [
			frappe._dict(city="A", block_from=501, block_to=501, priority=10),
			frappe._dict(city="A", block_from=510, block_to=510, priority=10),
		]
		out = dispatch._evaluate_team_coverage(target_block=500, target_city="A", rows=rows)
		self.assertEqual(out.get("match_type"), "nearest")
		self.assertEqual(out.get("distance"), 1)

	def test_assignment_state_for_partial_and_locked(self):
		self.assertEqual(dispatch._derive_assignment_state(3, 2, 0), "Under Assigned")
		self.assertEqual(dispatch._derive_assignment_state(1, 1, 0), "Assigned")
		self.assertEqual(dispatch._derive_assignment_state(1, 1, 1), "Manual Locked")

	def test_default_duration_prefers_service_type(self):
		original_service = dispatch._get_service_type_default_duration
		original_pest = dispatch._get_pest_type_default_duration
		try:
			dispatch._get_pest_type_default_duration = lambda pest_types: 0
			dispatch._get_service_type_default_duration = lambda service_type: 90
			self.assertEqual(
				dispatch._resolve_default_duration(service_type="General", fallback_duration=45),
				90,
			)
		finally:
			dispatch._get_service_type_default_duration = original_service
			dispatch._get_pest_type_default_duration = original_pest

	def test_default_duration_prefers_pest_type_highest(self):
		original_service = dispatch._get_service_type_default_duration
		original_pest = dispatch._get_pest_type_default_duration
		try:
			dispatch._get_pest_type_default_duration = lambda pest_types: 110
			dispatch._get_service_type_default_duration = lambda service_type: 90
			self.assertEqual(
				dispatch._resolve_default_duration(service_type="General", pest_types=["A", "B"], fallback_duration=45),
				110,
			)
		finally:
			dispatch._get_service_type_default_duration = original_service
			dispatch._get_pest_type_default_duration = original_pest

	def test_default_duration_fallback_is_75(self):
		original_service = dispatch._get_service_type_default_duration
		original_pest = dispatch._get_pest_type_default_duration
		try:
			dispatch._get_pest_type_default_duration = lambda pest_types: 0
			dispatch._get_service_type_default_duration = lambda service_type: 0
			self.assertEqual(dispatch._resolve_default_duration(service_type="Unknown", fallback_duration=0), 75)
			self.assertEqual(dispatch._resolve_default_duration(service_type="Unknown", fallback_duration=30), 30)
		finally:
			dispatch._get_service_type_default_duration = original_service
			dispatch._get_pest_type_default_duration = original_pest

	def test_slot_time_distance_prefers_requested_time(self):
		self.assertEqual(dispatch._slot_time_distance(900, 900), 0)
		self.assertEqual(dispatch._slot_time_distance(900, 840), 60)
		self.assertEqual(dispatch._slot_time_distance(900, None), 0)
