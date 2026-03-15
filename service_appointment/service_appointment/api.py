# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
import erpnext
import json
from frappe import _
from frappe.core.doctype.sms_settings.sms_settings import send_sms
from frappe.utils import get_date_str, getdate, get_datetime

def update_contract_status():
	""" Update contracts status """
	frappe.db.sql("""UPDATE `tabService Contract`
		SET `contract_status` = 'Expired' 
		WHERE CURDATE() > end_date
		AND docstatus = 1
		AND contract_status != 'Terminated'""")

	frappe.db.sql("""UPDATE `tabService Contract`
		SET `contract_status` = 'Active' 
		WHERE CURDATE() >= `start_date`
		AND CURDATE() <= `end_date`
		AND docstatus = 1
		AND contract_status != 'Terminated'""")

	frappe.db.sql("""UPDATE `tabService Contract`
		SET `contract_status` = 'Inactive' 
		WHERE CURDATE() < `start_date`
		AND docstatus = 1
		AND contract_status != 'Terminated'""")

def send_reminder_sms():
	appointments = frappe.db.sql("""SELECT *
		FROM `tabService Appointment`
		WHERE docstatus = 0
		AND appointment_status = 'Scheduled'
		AND reminder_sms = 0
		AND HOUR(TIMEDIFF(NOW(), TIMESTAMP(`date`, `time`))) <= 24
		AND HOUR(TIMEDIFF(NOW(), TIMESTAMP(`date`, `time`))) >= 23
		AND TIMESTAMP(`date`, `time`) > NOW()
	""", as_dict=1)

	for app in appointments:
		app_date = getdate(app.date).strftime('%d-%m-%Y')
		app_time = get_datetime(app.date + ' ' + app.time).strftime('%H:%M')
		mobile = '973' + app.mobile_no;

		message = 'شكراً لاختياركم القلاف\n'
		message += 'تذكير بموعدك تاريخ ' + app_date + ' الساعة ' + app_time
		message += 'هذه الرسالة تفيد موافقتكم على الشروط والتعليمات المرفقة https://bit.ly/3tLUB2y\n'
		message += 'يرجى مراجعتنا في حال وجود أي استفسار'

		send_sms([mobile], message)
		frappe.db.set_value('Service Appointment', app.name, 'reminder_sms', '1')

	frappe.db.commit()

def update_service_contract_visit(sales_invoice):
	si = frappe.get_doc("Sales Invoice", sales_invoice)
	service_appointment = si.items[0].service_appointment
	if service_appointment:
		visit = frappe.get_all('Service Contract Visit', filters={'service_appointment': service_appointment}, fields=['name'])
		for v in visit:
			frappe.db.set_value('Service Contract Visit', v.name, 'payment_status', si.status)
			frappe.msgprint('Service Contract appointment payment status updated successfully.')
		

def material_request_get_permission_query_conditions(user):
	if not user:
		user = frappe.session.user
	user_roles = frappe.get_roles(user)
	if "Driver" in user_roles and "Administrator" not in user_roles and "Store Keeper" not in user_roles:
		return """(
      		(
            	`tabMaterial Request`.`workflow_state`='Prepared' 
             	AND (`tabMaterial Request`.`custom_driver`='' OR `tabMaterial Request`.`custom_driver` IS NULL)
            )
			OR (
				`tabMaterial Request`.`custom_driver` != '' 
				AND `tabMaterial Request`.`custom_driver` = (SELECT w.`name` FROM `tabWarehouse` w WHERE w.`custom_user` = {user}) 
				AND `tabMaterial Request`.`workflow_state` IN('Hold By Driver', 'Prepared')
			)
		)""".format(user=frappe.db.escape(user))
  
	return None

def material_request_has_permission(doc, user):
	user_roles = frappe.get_roles(user)
	warehouses = frappe.get_all('Warehouse', filters={'custom_user': user}, fields=['name'])
	warehouse = warehouses[0].name if warehouses else None
	if "Driver" in user_roles and "Administrator" not in user_roles and "Store Keeper" not in user_roles:
		if (
      		(doc.workflow_state == 'Prepared' and not doc.custom_driver)
        	or (
            	doc.custom_driver 
             	and doc.custom_driver == warehouse
              	and doc.workflow_state in ['Hold By Driver', 'Prepared']
            )
        ):
			return True
	else:
		return True

	return False
	
