from __future__ import unicode_literals

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	custom_fields = {
		"Address": [
			{
				"fieldname": "building",
				"label": "Building",
				"fieldtype": "Data",
				"insert_after": "address_line2",
			},
			{
				"fieldname": "road",
				"label": "Road",
				"fieldtype": "Data",
				"insert_after": "building",
			},
			{
				"fieldname": "block_no",
				"label": "Block No",
				"fieldtype": "Int",
				"insert_after": "road",
			},
			{
				"fieldname": "flat",
				"label": "Flat",
				"fieldtype": "Data",
				"insert_after": "block_no",
			},
		]
	}
	create_custom_fields(custom_fields, update=True)
	_backfill_block_no_from_legacy_block()


def _backfill_block_no_from_legacy_block():
	try:
		has_legacy_block = frappe.db.has_column("Address", "block")
	except Exception:
		has_legacy_block = False

	if not has_legacy_block or not frappe.db.has_column("Address", "block_no"):
		return

	frappe.db.sql(
		"""
		UPDATE `tabAddress`
		SET `block_no` = NULLIF(CAST(`block` AS UNSIGNED), 0)
		WHERE (`block_no` IS NULL OR `block_no` = 0)
		  AND `block` IS NOT NULL
		  AND `block` != ''
		"""
	)

