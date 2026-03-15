frappe.listview_settings['Service Contract'] = {
	add_fields: ["contract_status"],
	get_indicator: function(doc)
	{
		if(doc.contract_status == "Active") {
			return [__("Active"), "green", "contract_status,=,Active"];
		}
		else if(doc.contract_status == "Inactive") {
			return [__("Inactive"), "blue", "contract_status,=,Inactive"];
		}
		else if(doc.contract_status == "Expired") {
			return [__("Expired"), "orange", "contract_status,=,Expired"];
		}
		else if(doc.contract_status == "Terminated") {
			return [__("Terminated"), "darkgrey", "contract_status,=,Terminated"];
		}
	}
};