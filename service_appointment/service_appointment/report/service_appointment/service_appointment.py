# Copyright (c) 2013, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt
from frappe.utils import (flt, getdate, get_first_day, add_months, add_days, formatdate)
from erpnext.accounts.utils import get_fiscal_year
from pprint import pprint
import json

def execute(filters=None):
	columns = get_columns(filters=filters)
	data, print_data = get_data(filters=filters)
	
	#Report Formatted Data
	formatted_date = frappe.utils.get_datetime(filters.date).strftime("%d %b %Y")
	formatted_month = frappe.utils.get_datetime(filters.date).strftime("%B %Y")
	formatted_year = frappe.utils.get_datetime(filters.date).strftime("%Y")

	return columns, data, [], [], [print_data]

def get_data(filters=None):
	conditions = ""
	if filters.get("date"):
		conditions += " and sa.`date` = %s" % frappe.db.escape(filters.get("date"))

	out = []
	print_data = []

	result = frappe.db.sql("""SELECT sa.`name`, sa.`customer`, cust.`mobile_no`, sa.`address_display`,
			sa.`date`, sa.`time`, sa.`total_amount`, sa.`service_type`, sa.`service_area_json`, sa.`location`,
			sa.`notes`, sa.`team`
		FROM `tabService Appointment` sa
		LEFT JOIN `tabCustomer` cust ON sa.`customer` = cust.`name`
		WHERE sa.`appointment_status` = 'Scheduled'
		{conditions}
		ORDER BY sa.`date`, sa.`time`
	""".format(conditions=conditions), as_dict=1)

	for row in result:
		service_areas = json.loads(row.service_area_json)
		area_type = '<br>'.join(str(d['area_type']) for d in service_areas) if service_areas else ""
		size = '<br>'.join(str(d['size']) for d in service_areas) if service_areas else ""
		qty = '<br>'.join(str(d['qty']) for d in service_areas) if service_areas else ""
		location = ""
		if row.location:
			location = " (" + row.location + ")"
		area_lines = []
		if service_areas:
			for d in service_areas:
				control_types = ', '.join(str(line['control_type']) for line in d['control_type'])
				area_lines.append(control_types)
				d['control_types'] = control_types
		control_type = '<br>'.join(area_lines)
		#description = '<br>'.join(d['description'] for d in service_areas)
		out.append({
			'name': row.name,
			'team': row.team,
			'customer': row.customer + location,
			'mobile_no': row.mobile_no,
			'address_display': row.address_display,
			'date': row.date,
			'time': row.time,
			'total_amount': row.total_amount,
			'service_type': row.service_type,
			'area_type': area_type,
			'size': size,
			'qty': qty,
			'control_type': control_type,
			#'description': description,
			'notes': row.notes
		})

		print_data.append({
			'name': row.name,
			'team': row.team,
			'customer': row.customer + location,
			'mobile_no': row.mobile_no,
			'address_display': row.address_display,
			'date': row.date,
			'time': row.time,
			'total_amount': row.total_amount,
			'service_type': row.service_type,
			'area_type': area_type,
			'size': size,
			'qty': qty,
			'control_type': control_type,
			#'description': description,
			'notes': row.notes,
			'service_areas': service_areas
		})
	
	return out, print_data

def get_columns(filters=None):
	columns = [
		{
			"fieldname": "name",
			"label": _("ID"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "team",
			"label": _("Team"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "customer",
			"label": _("Customer"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "mobile_no",
			"label": _("Mobile"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "address_display",
			"label": _("Address"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "date",
			"label": _("Date"),
			"fieldtype": "Date",
			"width": 150
		},
		{
			"fieldname": "time",
			"label": _("Time"),
			"fieldtype": "Time",
			"width": 150
		},
		{
			"fieldname": "total_amount",
			"label": _("Total Amount"),
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "service_type",
			"label": _("Service Type"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "area_type",
			"label": _("Area Type"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "size",
			"label": _("Size"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "qty",
			"label": _("Qty"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "control_type",
			"label": _("Control Type"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "description",
			"label": _("Description"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "no_of_visit",
			"label": _("No. of Visit"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "notes",
			"label": _("Notes"),
			"fieldtype": "Data",
			"width": 150
		}
	]

	return columns
