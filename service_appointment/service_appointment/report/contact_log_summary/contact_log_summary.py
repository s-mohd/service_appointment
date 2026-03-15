# Copyright (c) 2025, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
	"""Executes the report and returns columns and data."""
	"""
	Args:
		filters (dict): {
			"from_date": "2025-01-01",
			"to_date": "2025-12-31",
			"group_by": Reason or Channel
		}
	"""
	columns, data = get_columns(filters), get_data(filters)
	return columns, data

def get_columns(filters):
	"""Returns the columns for the report."""
	columns = [
		{
			"label": "User",
			"fieldname": "user",
			"fieldtype": "Link",
			"options": "User",
			"width": 200,
			"align": "left",
		}
	]
 
	# Add more columns based on the filters
	if filters.get("group_by") == "Reason":
		columns.append(
			{
				"label": "Reason",
				"fieldname": "reason",
				"fieldtype": "Data",
				"width": 200,
				"align": "left",
			}
		)
	elif filters.get("group_by") == "Channel":
		columns.append(
			{
				"label": "Channel",
				"fieldname": "channel",
				"fieldtype": "Data",
				"width": 200,
				"align": "left",
			}
		)
	columns.append(
		{
			"label": "Total",
			"fieldname": "total",
			"fieldtype": "Float",
			"width": 100,
			"align": "right",
		}
	)
 
	return columns
 
def get_data(filters):
	"""Returns the data for the report."""
	data = []
 
	if filters.get("group_by") == "Channel":
		records = frappe.db.sql("""
			SELECT owner as user, contact_time, contact_channel as channel, count(*) as total
			FROM `tabContact Log Record`
			WHERE contact_time BETWEEN %s AND %s
			GROUP BY owner, contact_channel
		""", (filters.get("from_date"), filters.get("to_date")), as_dict=True)
  
		user_totals = frappe._dict()
		for record in records:
			user = record.user
			channel = record.channel
			if user not in user_totals:
				user_totals[user] = frappe._dict()
			if channel not in user_totals[user]:
				user_totals[user][channel] = 0
			user_totals[user][channel] += record.total
   
		for user, channels in user_totals.items():
			data.append({
				"user": user,
				"parent_user": "",
				"total": sum(channels.values()),
				"indent": 0
			})
      
			for channel, total in channels.items():
				data.append(
					{
						"user": "",
						"parent_user": user,
						"channel": channel,
						"total": total,
						"indent": 1
					}
				)
	else:
		# Default to grouping by Reason
		records = frappe.db.sql("""
		SELECT clr.owner as user, clr.contact_time, cri.contact_reason as reason, count(*) as total
		FROM `tabContact Log Record` clr
		LEFT JOIN `tabContact Reason Item` cri ON clr.name = cri.parent
		WHERE clr.contact_time BETWEEN %s AND %s
		GROUP BY clr.owner, cri.contact_reason
		""", (filters.get("from_date"), filters.get("to_date")), as_dict=True)
		user_totals = frappe._dict()
		for record in records:
			user = record.user
			reason = record.reason
			if user not in user_totals:
				user_totals[user] = frappe._dict()
			if reason not in user_totals[user]:
				user_totals[user][reason] = 0
			user_totals[user][reason] += record.total
		for user, reasons in user_totals.items():
			data.append({
				"user": user,
				"parent_user": "",
				"total": frappe.db.count("Contact Log Record", {"owner": user, "contact_time": ["between", [filters.get("from_date"), filters.get("to_date")]]}),
				"indent": 0
			})
	  
			for reason, total in reasons.items():
				data.append(
					{
						"user": "",
						"parent_user": user,
						"reason": reason,
						"total": total,
						"indent": 1
					}
				)
	
	return data