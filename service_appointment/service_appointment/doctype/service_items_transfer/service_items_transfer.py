# Copyright (c) 2025, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ServiceItemsTransfer(Document):
	def on_submit(self):
		stock_entry = frappe.new_doc("Stock Entry")
		stock_entry.stock_entry_type = "Material Transfer"
		stock_entry.from_warehouse = self.from_warehouse
		stock_entry.set_posting_time = 1
		stock_entry.posting_date = self.posting_date
		stock_entry.posting_time = self.posting_time
		stock_entry.service_items_transfer = self.name

		for item in self.items:
			if item.qty > 0:
				stock_entry.append(
					"items",
					{
						"s_warehouse": self.from_warehouse,
						"t_warehouse": item.to_warehouse,
						"item_code": item.item,
						"qty": item.qty,
						"uom": item.uom
					},
				)
		stock_entry.save()
		stock_entry.submit()
  
	def on_cancel(self):
		stock_entries = frappe.get_all("Stock Entry", filters={"service_items_transfer": self.name, "docstatus": 1})
		if stock_entries:
			for stock_entry in stock_entries:
				se = frappe.get_doc("Stock Entry", stock_entry.name)
				se.cancel()