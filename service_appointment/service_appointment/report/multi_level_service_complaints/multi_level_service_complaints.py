# Copyright (c) 2013, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import getdate

def execute(filters=None):
	columns = get_columns(filters=filters)
	data = get_data(filters=filters)

	return columns, data

def get_data(filters=None):
	conditions = ""
	if filters.get("range"):
		conditions += " and sa.`date` >= %s and sa.`date` <= %s" % (frappe.db.escape(filters.get("range")[0]), frappe.db.escape(filters.get("range")[1]))

	out = []

	result = frappe.db.sql("""SELECT sa.`name`, sa.`customer`, sa.`appointment_status`, sa.`date` as service_date, emp.`employee_name` as completed_by,
		sa.`mobile_no`, cust_add.`city`, sa.`related_to`, sa.`service_type`, sa.`total_amount`
		FROM `tabService Appointment` sa
		LEFT JOIN `tabCustomer` cust ON sa.`customer` = cust.`name`
		LEFT JOIN `tabEmployee` emp ON emp.`name` = sa.`completed_by`
		LEFT JOIN `tabAddress` cust_add ON cust_add.`name` = sa.`customer_address`
		WHERE sa.appointment_status != 'Cancelled'
		AND sa.service_type IN ('Complaint', 'Contract Complaint')
		{conditions}
		ORDER BY sa.`date`, sa.`time`
	""".format(conditions=conditions), as_dict=1)

	sn = 1
	for row in result:
		# Variables 1
		complaint_date = ''
		complaint_status = ''
		complaint_completed_by = ''
		_completed_by = ''
		completed_by_om = ''
		complaint_completed_by_om = ''
		service_type = row.service_type
		service_amount = row.total_amount
		customer = row.customer
		comp_name = ''
		rt = ''
		items = ''
		complaint_items = ''
		pest_type = ''
		complaint_pest_type = ''

		# Variables 2
		complaint_date2 = ''
		complaint_status2 = ''
		complaint_completed_by2 = ''
		_completed_by2 = ''
		completed_by_om2 = ''
		complaint_completed_by_om2 = ''
		service_type2 = ''
		service_amount2 = ''
		rt2 = ''
		complaint_items2 = ''
		complaint_pest_type2 = ''

		# Service Appointment 1
		if row.related_to:
			rt_doc = frappe.get_doc("Service Appointment", row.related_to)
			complaint_date = rt_doc.date
			complaint_status = rt_doc.appointment_status
			completed_by = rt_doc.completed_by
			service_type = rt_doc.service_type
			service_amount = rt_doc.total_amount
			rt = rt_doc.related_to
			comp_name = row.related_to
			if completed_by:
				complaint_completed_by = frappe.get_value('Employee', completed_by, 'employee_name')
				members = []
				other_members = frappe.get_all('Team Member', fields='member_name', filters={'parent': row.related_to})
				for member in other_members:
					members.append(member.member_name)

				complaint_completed_by_om = ', '.join(members)

			if rt_doc.used_materials:
				complaint_items = ", ".join([(str(um.item) + " " + str(um.qty) + " " + str(um.uom)) for um in rt_doc.used_materials])

			complaint_p_types = []
			complaint_pest_types = frappe.get_all('Pest Type Item', fields='pest_type', filters={'parent': row.related_to})
			for p_type in complaint_pest_types:
				complaint_p_types.append(p_type.pest_type)

			complaint_pest_type = ', '.join(complaint_p_types)
		elif row.service_type == 'Complaint':
			cond = "and sa.`date` < %s and sa.customer = %s " % (frappe.db.escape(row.service_date), frappe.db.escape(row.customer))
			related_to = frappe.db.sql("""SELECT sa.`name`, sa.`appointment_status`, sa.`date`, emp.`employee_name` as completed_by,
					sa.`service_type`, sa.`total_amount`, sa.`related_to`
				FROM `tabService Appointment` sa
				LEFT JOIN `tabEmployee` emp ON emp.`name` = sa.`completed_by`
				WHERE sa.appointment_status != 'Cancelled'
				AND sa.appointment_status = 'Completed'
				{cond}
				ORDER BY sa.`date` DESC, sa.`time` DESC
				LIMIT 1
			""".format(cond=cond), as_dict=1)

			if related_to:
				complaint_date = related_to[0].date
				complaint_status = related_to[0].appointment_status
				complaint_completed_by = related_to[0].completed_by
				rt = related_to[0].related_to

				members = []
				other_members = frappe.get_all('Team Member', fields='member_name', filters={'parent': related_to[0].name})
				for member in other_members:
					members.append(member.member_name)

				complaint_completed_by = ', '.join(members)				

				service_type = related_to[0].service_type
				service_amount = related_to[0].total_amount

				comp_name = related_to[0].name

				used_materials = frappe.get_all('Raw Material Item', fields=["item", "qty", "uom"], filters={'parent': related_to[0].name})
				if used_materials:
					complaint_items = ", ".join([(str(um.item) + " " + str(um.qty) + " " + str(um.uom)) for um in used_materials])

				complaint_p_types = []
				complaint_pest_types = frappe.get_all('Pest Type Item', fields='pest_type', filters={'parent': related_to[0].name})
				for p_type in complaint_pest_types:
					complaint_p_types.append(p_type.pest_type)

				complaint_pest_type = ', '.join(complaint_p_types)

		# Service Appointment 2
		if rt:
			complaint_date2 = frappe.get_value('Service Appointment', rt, 'date')
			complaint_status2 = frappe.get_value('Service Appointment', rt, 'appointment_status')
			completed_by2 = frappe.get_value('Service Appointment', rt, 'completed_by')
			service_type2 = frappe.get_value('Service Appointment', rt, 'service_type')
			service_amount2 = frappe.get_value('Service Appointment', rt, 'total_amount')

			if completed_by2:
				complaint_completed_by2 = frappe.get_value('Employee', completed_by2, 'employee_name')
				members = []
				other_members = frappe.get_all('Team Member', fields='member_name', filters={'parent': rt})
				for member in other_members:
					members.append(member.member_name)

				complaint_completed_by_om2 = ', '.join(members)

			used_materials = frappe.get_all('Raw Material Item', fields=["item", "qty", "uom"], filters={'parent': rt})
			if used_materials:
				complaint_items2 = ", ".join([(str(um.item) + " " + str(um.qty) + " " + str(um.uom)) for um in used_materials])

			complaint_p_types2 = []
			complaint_pest_types2 = frappe.get_all('Pest Type Item', fields='pest_type', filters={'parent': rt})
			for p_type in complaint_pest_types2:
				complaint_p_types2.append(p_type.pest_type)

			complaint_pest_type2 = ', '.join(complaint_p_types2)
		elif service_type == 'Complaint':
			cond = "and sa.`date` < %s and sa.customer = %s " % (frappe.db.escape(complaint_date), frappe.db.escape(customer))
			related_to = frappe.db.sql("""SELECT sa.`name`, sa.`appointment_status`, sa.`date`, emp.`employee_name` as completed_by,
					sa.`service_type`, sa.`total_amount`
				FROM `tabService Appointment` sa
				LEFT JOIN `tabEmployee` emp ON emp.`name` = sa.`completed_by`
				WHERE sa.appointment_status != 'Cancelled'
				AND sa.appointment_status = 'Completed'
				{cond}
				ORDER BY sa.`date` DESC, sa.`time` DESC
				LIMIT 1
			""".format(cond=cond), as_dict=1)

			if related_to:
				complaint_date2 = related_to[0].date
				complaint_status2 = related_to[0].appointment_status
				complaint_completed_by2 = related_to[0].completed_by

				members = []
				other_members = frappe.get_all('Team Member', fields='member_name', filters={'parent': related_to[0].name})
				for member in other_members:
					members.append(member.member_name)

				complaint_completed_by_om2 = ', '.join(members)				

				service_type2 = related_to[0].service_type
				service_amount2 = related_to[0].total_amount

				used_materials = frappe.get_all('Raw Material Item', fields=["item", "qty", "uom"], filters={'parent': related_to[0].name})
				if used_materials:
					complaint_items2 = ", ".join([(str(um.item) + " " + str(um.qty) + " " + str(um.uom)) for um in used_materials])

				complaint_p_types2 = []
				complaint_pest_types2 = frappe.get_all('Pest Type Item', fields='pest_type', filters={'parent': related_to[0].name})
				for p_type in complaint_pest_types2:
					complaint_p_types2.append(p_type.pest_type)

				complaint_pest_type2 = ', '.join(complaint_p_types2)

		members = []
		other_members = frappe.get_all('Team Member', fields='member_name', filters={'parent': row.name})
		for member in other_members:
			members.append(member.member_name)

		completed_by_om = ', '.join(members)

		if complaint_date2 and comp_name:
			members = []
			other_members = frappe.get_all('Team Member', fields='member_name', filters={'parent': comp_name})
			for member in other_members:
				members.append(member.member_name)

			completed_by_om2 = ', '.join(members)	
		
		used_materials = frappe.get_all('Raw Material Item', fields=["item", "qty", "uom"], filters={'parent': row.name})
		if used_materials:
			items = ", ".join([(str(um.item) + " " + str(um.qty) + " " + str(um.uom)) for um in used_materials])

		p_types = []
		pest_types = frappe.get_all('Pest Type Item', fields='pest_type', filters={'parent': row.name})
		for p_type in pest_types:
			p_types.append(p_type.pest_type)

		pest_type = ', '.join(p_types)

		if (
			(
				filters.get('service_date') 
				and (
					(
						complaint_date2 and getdate(complaint_date2) >= getdate(filters.get("service_date")[0])
						and getdate(complaint_date2) <= getdate(filters.get("service_date")[1])
					) or (
						not complaint_date2 and complaint_date and getdate(complaint_date) >= getdate(filters.get("service_date")[0])
						and getdate(complaint_date) <= getdate(filters.get("service_date")[1])
					)
				)
			) or (not filters.get('service_date'))
		):
			if complaint_date2:
				out.append({
					'sn': sn,
					'customer_name': row.customer,
					'mobile_no': row.mobile_no,
					'area': row.city,
					'service_date': complaint_date2,
					'service_type': service_type2,
					'pest_type': complaint_pest_type2,
					'service_amount': service_amount2,
					'appointment_status': complaint_status2,
					'completed_by': complaint_completed_by2,
					'appointment_other_members': complaint_completed_by_om2,
					'items': complaint_items2,
					'complaint_date': complaint_date,
					'complaint_pest_type': complaint_pest_type,
					'complaint_appointment_status': complaint_status,
					'complaint_completed_by': complaint_completed_by,
					'complaint_completed_by_om': complaint_completed_by_om,
					'complaint_items': complaint_items,
					'complaint_date2': row.service_date,
					'complaint_pest_type2': pest_type,
					'complaint_appointment_status2': row.appointment_status,
					'complaint_completed_by2': row.completed_by,
					'complaint_completed_by_om2': completed_by_om,
					'complaint_items2': items
				})
			else:
				out.append({
					'sn': sn,
					'customer_name': row.customer,
					'mobile_no': row.mobile_no,
					'area': row.city,
					'service_date': complaint_date,
					'service_type': service_type,
					'pest_type': complaint_pest_type,
					'service_amount': service_amount,
					'appointment_status': complaint_status,
					'completed_by': complaint_completed_by,
					'items': complaint_items,
					'appointment_other_members': complaint_completed_by_om,
					'complaint_date': row.service_date,
					'complaint_pest_type': pest_type,
					'complaint_appointment_status': row.appointment_status,
					'complaint_completed_by': row.completed_by,
					'complaint_completed_by_om': completed_by_om,
					'complaint_items': items
				})
			
			sn += 1
	
	return out

def get_columns(filters=None):
	columns = [
		{
			"fieldname": "sn",
			"label": _("SN"),
			"fieldtype": "Data",
			"width": 50
		},
		{
			"fieldname": "mobile_no",
			"label": _("Mobile No."),
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "service_type",
			"label": _("Service Type"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "service_amount",
			"label": _("Service Amount"),
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "service_date",
			"label": _("Service Date"),
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "pest_type",
			"label": _("Pest Type"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "items",
			"label": _("Items"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "completed_by",
			"label": _("Completed By"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "appointment_other_members",
			"label": _("Other Members"),
			"fieldtype": "Data",
			"width": 200
		},
		# {
		# 	"fieldname": "customer_name",
		# 	"label": _("Customer Name"),
		# 	"fieldtype": "Data",
		# 	"width": 200
		# },
		# {
		# 	"fieldname": "area",
		# 	"label": _("Area"),
		# 	"fieldtype": "Data",
		# 	"width": 150
		# },
		# {
		# 	"fieldname": "appointment_status",
		# 	"label": _("Appointment Status"),
		# 	"fieldtype": "Data",
		# 	"width": 150
		# },
		{
			"fieldname": "complaint_date",
			"label": _("Complaint Date"),
			"fieldtype": "Date",
			"width": 150
		},
		{
			"fieldname": "complaint_pest_type",
			"label": _("Complaint Pest Type"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "complaint_items",
			"label": _("Complaint Items"),
			"fieldtype": "Data",
			"width": 200
		},
		# {
		# 	"fieldname": "complaint_appointment_status",
		# 	"label": _("Complaint Appointment Status"),
		# 	"fieldtype": "Data",
		# 	"width": 200
		# },
		{
			"fieldname": "complaint_completed_by",
			"label": _("Complaint Completed By"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "complaint_completed_by_om",
			"label": _("Complaint Other Members"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "complaint_date2",
			"label": _("Complaint Date 2"),
			"fieldtype": "Date",
			"width": 150
		},
		{
			"fieldname": "complaint_pest_type2",
			"label": _("Complaint Pest Type 2"),
			"fieldtype": "Data",
			"width": 150
		},
		# {
		# 	"fieldname": "complaint_appointment_status2",
		# 	"label": _("Complaint Appointment Status 2"),
		# 	"fieldtype": "Data",
		# 	"width": 200
		# },
		{
			"fieldname": "complaint_items2",
			"label": _("Complaint Items 2"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "complaint_completed_by2",
			"label": _("Complaint Completed By 2"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "complaint_completed_by_om2",
			"label": _("Complaint Other Members 2"),
			"fieldtype": "Data",
			"width": 200
		},
	]

	return columns
