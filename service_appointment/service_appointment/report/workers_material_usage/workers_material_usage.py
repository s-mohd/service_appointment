# Copyright (c) 2013, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt
import json

def execute(filters=None):
	columns = get_columns(filters=filters)
	data = get_data(filters=filters)

	return columns, data

def get_data(filters=None):
	conditions = ""
	if filters.get("range"):
		conditions += " and sa.`date` >= %s and sa.`date` <= %s" % (frappe.db.escape(filters.get("range")[0]), frappe.db.escape(filters.get("range")[1]))

	if filters.get("worker"):
		conditions += " AND completed_by = %s" % (frappe.db.escape(filters.get("employee")[0]))

	out = []

	result = frappe.db.sql("""SELECT sa.`name`, sa.`customer`, sa.`appointment_status`, sa.`date`, sa.`service_type`, emp.`employee_name` as completed_by,
		sa.`mobile_no`, sa.`total_amount`, cust_add.`city`, sa.`received_amount` as service_paid_amount, sa.`mode_of_payment`, sa.`sales_person`,
		sa.`notes`, sa.`service_area_json`, sa.`location`
		FROM `tabService Appointment` sa
		LEFT JOIN `tabCustomer` cust ON sa.`customer` = cust.`name`
		LEFT JOIN `tabEmployee` emp ON emp.`name` = sa.`completed_by`
		LEFT JOIN `tabAddress` cust_add ON cust_add.`name` = sa.`customer_address`
		WHERE sa.appointment_status = 'Completed'
		{conditions}
		ORDER BY sa.`date`, sa.`time`
	""".format(conditions=conditions), as_dict=1)

	for row in result:
		service_id = row.name
		service_appointment = frappe.get_doc('Service Appointment', row.name)
		workers = row.completed_by
		if service_appointment.other_members:
			workers += ', ' + ' ,'.join(d.member_name for d in service_appointment.other_members)

		service_areas = json.loads(row.service_area_json)
		treated_areas = []
		for d in service_areas:
			control_types = ', '.join(line['control_type'] for line in d['control_type'])
			treated_areas.append(str(d['qty']) + " " + str(d['size']) + " " + str(d['area_type']))

		treated_area = ", ".join(treated_areas)

		insect_type = ", ".join([ptype.pest_type for ptype in service_appointment.pest_type])

		service_amount = row.total_amount

		used_materials_list = []
		for um in service_appointment.used_materials:
			used_materials_list.append(str(um.qty) + " " + str(um.uom) + " " + str(um.item))
		used_materials = "<br>".join(used_materials_list)

		notes = row.notes

		out.append({
			'service_id': service_id,
			'workers': workers,
			'treated_area': treated_area,
			'insect_type': insect_type,
			'service_amount': service_amount,
			'used_materials': used_materials,
			'notes': notes
		})

	return out

def get_columns(filters=None):
	columns = [
		{
			"fieldname": "service_id",
			"label": _("Service ID"),
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "workers",
			"label": _("Workers"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "treated_area",
			"label": _("Treated Area"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "insect_type",
			"label": _("Insect Type"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "service_amount",
			"label": _("Service Amount"),
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "used_materials",
			"label": _("Used Materials"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "notes",
			"label": _("Notes"),
			"fieldtype": "Data",
			"width": 200
		}
	]

	return columns