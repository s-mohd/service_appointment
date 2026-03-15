from __future__ import unicode_literals

import frappe


def boot_session(bootinfo):
	if frappe.session.user == "Guest":
		return

	roles = set(frappe.get_roles(frappe.session.user))
	if "Service Team" in roles and "System Manager" not in roles:
		bootinfo.home_page = "technician-services"
