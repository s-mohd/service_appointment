from __future__ import unicode_literals, print_function
import frappe
import json
from pprint import pprint
from frappe.utils import flt

@frappe.whitelist()
def get_schedule_records(date_range):
    teams = frappe.get_all('Team', fields=['name', 'team_name'], order_by='team_name asc')
    date_range = json.loads(date_range)
    date_list = []
    out = []

    for count in range(frappe.utils.date_diff(date_range[1], date_range[0])+1):
        date_list.append(frappe.utils.add_days(date_range[0], count))

    emp_string = ''
    if teams:
        teams_string = "'" + "', '".join([team.name for team in teams]) + "'"
        
        records = frappe.db.sql("""SELECT sta.*, team.team_name, team.name as team_docname
            FROM `tabService Team Availability` sta
            LEFT JOIN `tabTeam` team ON sta.team = team.name
            WHERE sta.team in ({teams_string})
            AND sta.date >= %(start_date)s
            AND sta.date <= %(end_date)s
            ORDER BY team.team_name asc
        """.format(teams_string=teams_string), {'start_date': date_range[0], 'end_date': date_range[1]}, as_dict=1)

        for date in date_list:
            date_records = []

            for team in teams:
                exist = False
                for record in records:
                    if team.team_name == record.team_name and date == frappe.utils.get_date_str(record.date):
                        date_records.append(record)
                        exist = True
            
                if not exist:
                    date_records.append({
                        'team_docname': team.name,
                        'team_name': team.team_name,
                        'date': date,
                        'hour_00': 0,
                        'hour_01': 0,
                        'hour_02': 0,
                        'hour_03': 0,
                        'hour_04': 0,
                        'hour_05': 0,
                        'hour_06': 0,
                        'hour_07': 0,
                        'hour_08': 0,
                        'hour_09': 0,
                        'hour_10': 0,
                        'hour_11': 0,
                        'hour_12': 0,
                        'hour_13': 0,
                        'hour_14': 0,
                        'hour_15': 0,
                        'hour_16': 0,
                        'hour_17': 0,
                        'hour_18': 0,
                        'hour_19': 0,
                        'hour_20': 0,
                        'hour_21': 0,
                        'hour_22': 0,
                        'hour_23': 0
                    })
            
            out.append({
                'date_display': frappe.utils.get_datetime(date).strftime('%A, %-d %B %Y'),
                'records': date_records
            })

    return out

@frappe.whitelist()
def update_schedule(data):
    import json

    changed_data = json.loads(data)
    data_dict = frappe._dict()

    for item in changed_data:
        data_dict.setdefault((item['date'], item['team']), []).append({'name': item['hour'], 'value': item['value']})

    for date, team in data_dict:
        hours = data_dict.get((date, team), [])
        hours_string = [(str(hour['name']) + ' = ' + str(hour['value'])) for hour in hours]
        hours_string = ', '.join(hours_string)
        if frappe.db.exists({'doctype': 'Service Team Availability', 'date': date, 'team':team}):
            frappe.db.sql("""UPDATE `tabService Team Availability`
                SET {hours_string}
                WHERE date = %(date)s
                AND team = %(team)s""".format(hours_string=hours_string), {'date': date, 'team': team})
        else:
            new_doc = frappe.new_doc('Service Team Availability')
            new_doc.set('date', date)
            new_doc.set('team', team)
            for hour in hours:
                new_doc.set(hour['name'], hour['value'])
            new_doc.save()

    return "Schedule Updated Successfully"

@frappe.whitelist()
def schedule(date, employee, shift_type):
    new_doc = frappe.new_doc("Shift Assignment")
    new_doc.date = date
    new_doc.employee = employee
    new_doc.shift_type = shift_type
    new_doc.save()
    new_doc.submit()

    return "Shift Assigned Successfully"

@frappe.whitelist()
def cancel_shift_assignment(shift_assignment):
    old_doc = frappe.get_doc("Shift Assignment", shift_assignment)
    old_doc.cancel()

    return "Shift Cancelled Successfully"