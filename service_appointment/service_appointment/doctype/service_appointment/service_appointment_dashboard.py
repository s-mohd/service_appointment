from __future__ import unicode_literals
from frappe import _

def get_data():
	return {
        'fieldname': 'service_appointment',
		'transactions': [
			{
				'items': ['Sales Invoice', 'Stock Entry']
			}
		]
	}
