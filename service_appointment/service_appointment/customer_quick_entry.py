from frappe.utils import cstr
from frappe import _
import frappe


def _address_field_exists(fieldname):
	return frappe.get_meta("Address").has_field(fieldname)


def custom_customer_info(doc, method):
    # this function will get call `on_update` as we define in hook.py
    add_address_info(doc)


def add_address_info(doc):
    if doc.flags.is_new_doc and doc.get('city'):
        # this name construct should work
        # because we just create this customer
        # Billing is default type
        # there shouldn't be any more address of this customer
        reqd_fields = []
        for field in ['city', 'country']:
            if not doc.get(field):
                reqd_fields.append( '<li>' + field.title() + '</li>')

        if reqd_fields:
            msg = _("Following fields are mandatory to create address:")
            frappe.throw("{0} <br><br> <ul>{1}</ul>".format(msg, '\n'.join(reqd_fields)),
                title = _("Missing Values Required"))

        block_no = doc.get("block_no") or doc.get("block")
        address_payload = {
            'doctype': 'Address',
            'address_title': doc.get('name'),
            'address_line1': doc.get('address_line1'),
            'city': doc.get('city'),
            'country': doc.get('country'),
            'links': [{
                'link_doctype': 'Customer',
                'link_name': doc.get('name')
            }]
        }

        optional_address_fields = {
            'building': doc.get('building'),
            'road': doc.get('road'),
            'flat': doc.get('flat'),
            'block_no': block_no,
        }
        for fieldname, value in optional_address_fields.items():
            if value and _address_field_exists(fieldname):
                address_payload[fieldname] = value

        if block_no and _address_field_exists("block") and not _address_field_exists("block_no"):
            address_payload["block"] = block_no

        frappe.get_doc(address_payload).insert()
