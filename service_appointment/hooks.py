# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from . import __version__ as app_version

app_name = "service_appointment"
app_title = "Service Appointment"
app_publisher = "Sayed Hameed Ebrahim"
app_description = "Manage Service Appointments"
app_icon = "fa fa-calendar"
app_color = "grey"
app_email = "sayed.saar@gmail.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/service_appointment/css/service_appointment.css"
# app_include_js = "/assets/service_appointment/js/service_appointment.js"

# include js, css files in header of web template
# web_include_css = "/assets/service_appointment/css/service_appointment.css"
# web_include_js = "/assets/service_appointment/js/service_appointment.js"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Website user home page (by function)
# get_website_user_home_page = "service_appointment.utils.get_home_page"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "service_appointment.install.before_install"
# after_install = "service_appointment.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "service_appointment.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

permission_query_conditions = {
	"Material Request": "service_appointment.service_appointment.api.material_request_get_permission_query_conditions",
}

has_permission = {
	"Material Request": "service_appointment.service_appointment.api.material_request_has_permission",
}

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
#	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"service_appointment.tasks.all"
# 	],
# 	"daily": [
# 		"service_appointment.tasks.daily"
# 	],
# 	"hourly": [
# 		"service_appointment.tasks.hourly"
# 	],
# 	"weekly": [
# 		"service_appointment.tasks.weekly"
# 	]
# 	"monthly": [
# 		"service_appointment.tasks.monthly"
# 	]
# }

# Testing
# -------

# before_tests = "service_appointment.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "service_appointment.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "service_appointment.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

#doc_events = {
#	"Sales Invoice": {
#		"on_submit": "service_appointment.service_appointment.doctype.service_appointment.service_appointment.update_invoiced_amount",
#	}
#}

scheduler_events = {
	"daily": [
		"service_appointment.service_appointment.api.update_contract_status"
	],
	"hourly": [
		"service_appointment.service_appointment.api.send_reminder_sms"
	]
}

app_include_js = [
	'/assets/service_appointment/js/customer_quick_entry.js',
]

boot_session = "service_appointment.service_appointment.startup.boot.boot_session"

doc_events = {
    'Customer': {
        'on_update': 'service_appointment.service_appointment.customer_quick_entry.custom_customer_info'
    }
}

fixtures = [
	{"dt": "Custom Field", "filters": [
		[
			"name", "in", [
				'Sales Invoice Item-service_appointment',
				'Sales Invoice Item-service_appointment_item',
				'Stock Entry-service_appointment'
			]
		]
	]},
	{"dt": "Print Format", "filters": [
		[
			"name", "in", [
				'Service Appointment'
			]
		]
	]}
]
