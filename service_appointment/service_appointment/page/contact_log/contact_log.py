# -*- coding: utf-8 -*-
# Copyright (c) 2018, ESS LLP and contributors
# For license information, please see license.txt


import json

import frappe
from frappe.utils import cint, getdate, get_datetime


@frappe.whitelist()
def get_feed(name, document_types=None, date_range=None, start=0, page_length=20):
	"""get feed""" 
	data = frappe._dict()
	
	date_range = json.loads(date_range) if date_range else None
	document_types = json.loads(document_types) if document_types else None
	if not document_types:
		document_types = get_contact_log_doctypes()
 
	all_data = []
	for doc in document_types:
		feed_data = get_feed_for_dt(doc, name, date_range)
		data.setdefault(doc, feed_data)
		all_data += feed_data
  
	# sort by each doctype's date then by creation date
	all_data = sorted(all_data, key=lambda x: (get_datetime(x.get("_date")), get_datetime(x.get("creation"))), reverse=True)

	return all_data


@frappe.whitelist()
def get_feed_for_dt(doctype, docname, date_range=None):
	"""get feed"""
	result = []
	date_field = None
	doctype_color = {
		"Service Appointment": "text-primary",
		"Sales Invoice": "text-danger",
		"Delivery Note": "text-warning",
		"Quotation": "text-info",
		"Sales Order": "text-info",
		"Payment Entry": "text-success",
		"Contact Log Record": "text-muted"
	}
 
	# Service Appointment
	if doctype == "Service Appointment":
		filters = {"customer": docname, "docstatus": ["!=", 2]}
		if date_range:
			filters["date"] = ["between", [date_range[0], date_range[1]]]
		fields = ["name", "date", "time", "service_type", "total_amount", "appointment_status", "guarantee_qty", "guarantee_uom", "expiry_date", "owner", "creation"]
		result = frappe.db.get_all(doctype, filters=filters, fields=fields)
		date_field = "date"
		if result:
			for r in result:
				if r.expiry_date and getdate(r.expiry_date) < getdate():
					r['_is_valid'] = "Not Valid"
				else:
					r['_is_valid'] = "Valid"
  
	# Sales Invoice
	elif doctype == "Sales Invoice":
		filters = {"customer": docname, "docstatus": ["!=", 2]}
		if date_range:
			filters["posting_date"] = ["between", [date_range[0], date_range[1]]]
		fields = ["name", "posting_date", "grand_total", "outstanding_amount", "status", "owner", "creation"]
		result = frappe.db.get_all(doctype, filters=filters, fields=fields)
		date_field = "posting_date"
  
	# Delivery Note
	elif doctype == "Delivery Note":
		filters = {"customer": docname, "docstatus": ["!=", 2]}
		if date_range:
			filters["posting_date"] = ["between", [date_range[0], date_range[1]]]
		fields = ["name", "posting_date", "grand_total", "workflow_state", "status", "owner", "creation"]
		result = frappe.db.get_all(doctype, filters=filters, fields=fields)
		date_field = "posting_date"
  
	# Quotation
	elif doctype == "Quotation":
		filters = {"party_name": docname, "docstatus": ["!=", 2]}
		if date_range:
			filters["transaction_date"] = ["between", [date_range[0], date_range[1]]]
		fields = ["name", "transaction_date", "grand_total", "status", "owner", "creation"]
		result = frappe.db.get_all(doctype, filters=filters, fields=fields)
		date_field = "transaction_date"
  
	# Sales Order
	elif doctype == "Sales Order":
		filters = {"customer": docname, "docstatus": ["!=", 2]}
		if date_range:
			filters["transaction_date"] = ["between", [date_range[0], date_range[1]]]
		fields = ["name", "transaction_date", "grand_total", "status", "owner", "creation"]
		result = frappe.db.get_all(doctype, filters=filters, fields=fields)
		date_field = "transaction_date"
  
	# Payment Entry
	elif doctype == "Payment Entry":
		filters = {"party": docname, "docstatus": ["!=", 2]}
		if date_range:
			filters["posting_date"] = ["between", [date_range[0], date_range[1]]]
		fields = ["name", "posting_date", "paid_amount", "status", "mode_of_payment", "owner", "creation"]
		result = frappe.db.get_all(doctype, filters=filters, fields=fields)
		date_field = "posting_date"
  
	# Contact Log Record
	elif doctype == "Contact Log Record":
		filters = {"customer": docname}
		if date_range:
			filters["contact_time"] = ["between", [date_range[0], date_range[1]]]
		result = frappe.db.get_all(doctype, filters=filters, fields="*")
		date_field = "contact_time"

	for r in result:
		r["doctype"] = doctype
		r["_date"] = r.get(date_field)
		r["_color"] = doctype_color[doctype]

	return result


@frappe.whitelist()
def get_contact_log_doctypes():
	document_types = ["Service Appointment", "Sales Invoice", "Delivery Note", "Quotation", "Sales Order", "Payment Entry", "Contact Log Record"]

	return document_types


@frappe.whitelist()
def save_contact_log(doc, reasons):
	"""save contact log"""
	doc = frappe._dict(json.loads(doc))
	doc.setdefault("doctype", "Contact Log Record")
	doc = frappe.get_doc(doc)
	reasons = json.loads(reasons)
	for reason in reasons:
		doc.append("reason", {"contact_reason": reason})
	doc.insert(ignore_permissions=True)
	frappe.db.commit()
	return doc
