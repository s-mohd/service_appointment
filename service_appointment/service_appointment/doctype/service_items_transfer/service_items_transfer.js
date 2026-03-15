// Helper function to set up event listeners for the transposed HTML table
function setupTransposedTableEventListeners(frm, template_data) {
    setTimeout(() => {
        // Remove row functionality (removes an item row)
        $(frm.fields_dict.items_display.wrapper)
            .find('.remove-row')
            .on('click', function() {
                const $row = $(this).closest('tr');
                const item_code = $row.attr('data-item');
                // Remove all child table rows for this item
                if (item_code) {
                    const items_to_remove = frm.doc.items.filter(item => item.item === item_code);
                    items_to_remove.forEach(item => {
                        frm.get_field("items").grid.grid_rows_by_docname[item.name].remove();
                    });
                    frm.refresh_field("items");
                }
                $row.remove();
            });

        // Add quantity change listener
        $(frm.fields_dict.items_display.wrapper)
            .find('input[type="number"]')
            .on('change', function() {
                const $input = $(this);
                const warehouse = $input.attr('data-warehouse');
                const item_code = $input.attr('data-item');
                const qty = parseFloat($input.val()) || 0;

                // Find and update the corresponding row in the items child table
                const child_row = frm.doc.items.find(
                    row => row.to_warehouse === warehouse && row.item === item_code
                );

                if (child_row) {
                    frappe.model.set_value(
                        child_row.doctype, 
                        child_row.name, 
                        'qty', 
                        qty
                    );
                } else if (warehouse && qty > 0) {
                    // If no existing row, add a new one
                    let row = frm.add_child("items");
                    row.to_warehouse = warehouse;
                    row.item = item_code;
                    row.qty = qty;

                    // Try to get UOM from template items
                    const template_item = template_data.items.find(i => i.item === item_code);
                    if (template_item) {
                        row.uom = template_item.uom;
                    }
                    frm.refresh_field("items");
                }
            });

        // Add new row functionality (add new item row)
        $(frm.fields_dict.items_display.wrapper)
            .find('.add-new-row')
            .on('click', function() {
                let table = $(frm.fields_dict.items_display.wrapper).find('table');
                let newRow = $("<tr>");

                // Add item select cell
                newRow.append(`<td>
                    <select class="form-control item-select">
                        <option value="">Select Item</option>
                    </select>
                </td>`);

                // Add cells for each warehouse
                for (let warehouse of template_data.warehouses) {
                    newRow.append(`<td>
                        <input type="number" min="0" class="form-control" 
                        data-warehouse="${warehouse.warehouse}" style="width:80px;" value="0" />
                    </td>`);
                }

                // Add delete button
                newRow.append(`<td>
                    <button type="button" class="btn btn-danger btn-sm remove-row">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>`);

                // Insert the new row before the "Add New" button row
                $(this).closest('tr').before(newRow);

                // Populate item options
                let itemSelect = newRow.find('.item-select');
                itemSelect.empty();
                itemSelect.append(`<option value="">Select Item</option>`);
                for (let item of template_data.items) {
                    itemSelect.append(`<option value="${item.item}" data-uom="${item.uom}">
                        ${item.item} (${item.uom})
                    </option>`);
                }

                // Add remove event listener to the new row's button
                newRow.find('.remove-row').on('click', function() {
                    const $row = $(this).closest('tr');
                    const item_code = itemSelect.val();
                    // Remove corresponding rows from the items child table if item is selected
                    if (item_code) {
                        const items_to_remove = frm.doc.items.filter(item => item.item === item_code);
                        items_to_remove.forEach(item => {
                            frm.get_field("items").grid.grid_rows_by_docname[item.name].remove();
                        });
                        frm.refresh_field("items");
                    }
                    $row.remove();
                });

                // Update data-item attribute when item is selected
                itemSelect.on('change', function() {
                    let selectedItem = $(this).val();
                    newRow.attr('data-item', selectedItem);
                    newRow.find('input[type="number"]').attr('data-item', selectedItem);
                    // Add event listeners to new inputs
                    newRow.find('input[type="number"]').on('change', function() {
                        const $input = $(this);
                        const warehouse = $input.attr('data-warehouse');
                        const item_code = $input.attr('data-item');
                        const qty = parseFloat($input.val()) || 0;

                        // If item is selected, update or create child table rows
                        if (item_code && warehouse) {
                            const child_row = frm.doc.items.find(
                                row => row.to_warehouse === warehouse && row.item === item_code
                            );

                            if (child_row) {
                                frappe.model.set_value(
                                    child_row.doctype, 
                                    child_row.name, 
                                    'qty', 
                                    qty
                                );
                            } else if (qty > 0) {
                                // Add new row to the child table
                                let row = frm.add_child("items");
                                row.to_warehouse = warehouse;
                                row.item = item_code;
                                row.qty = qty;

                                // Try to get UOM from template items
                                const template_item = template_data.items.find(i => i.item === item_code);
                                if (template_item) {
                                    row.uom = template_item.uom;
                                }
                                frm.refresh_field("items");
                            }
                        }
                    });
                });
            });
    }, 100);
}

frappe.ui.form.on("Service Items Transfer", {
    refresh(frm) {
        if (frm.doc.items && frm.doc.items.length > 0) {
            // Group items by item code, then by warehouse, preserving original order
            const warehouses = [];
            const items_map = {};
            const item_order = [];

            frm.doc.items.forEach(item => {
            if (!warehouses.includes(item.to_warehouse)) {
                warehouses.push(item.to_warehouse);
            }
            if (!items_map[item.item]) {
                items_map[item.item] = { uom: item.uom, qtys: {} };
                item_order.push(item.item);
            }
            items_map[item.item].qtys[item.to_warehouse] = item.qty;
            });

            // Do not sort warehouses or items, keep original order
            const unique_items = item_order.map(item_code => ({
            item: item_code,
            uom: items_map[item_code].uom
            }));

            // Build transposed table
            let items_html = "<table class='table table-bordered'><thead><tr><th>Item (UOM)</th>";
            for (let warehouse of warehouses) {
            items_html += `<th>${warehouse}</th>`;
            }
            items_html += "<th><i class='fa fa-trash'></i></th></tr></thead><tbody>";

            for (let item_obj of unique_items) {
            items_html += `<tr data-item="${item_obj.item}"><td>${item_obj.item} (${item_obj.uom || ''})</td>`;
            for (let warehouse of warehouses) {
                const qty = (items_map[item_obj.item].qtys[warehouse]) || 0;
                items_html += `<td><input type="number" min="0" class="form-control" data-warehouse="${warehouse}" data-item="${item_obj.item}" style="width:80px;" value="${qty}" /></td>`;
            }
            items_html += `<td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fa fa-trash"></i></button></td>`;
            items_html += "</tr>";
            }

            items_html += `<tr><td colspan="${warehouses.length + 2}" class="text-center">
            <button type="button" class="btn btn-success btn-sm add-new-row">
                <i class="fa fa-plus"></i> Add New Row
            </button>
            </td></tr>`;
            items_html += "</tbody></table>";
            frm.fields_dict.items_display.set_value(items_html);

            // Add event listeners
            setTimeout(() => {
            setupTransposedTableEventListeners(frm, { items: unique_items, warehouses: warehouses.map(w => ({ warehouse: w })) });
            }, 100);
        } else if (frm.doc.template) {
            frm.trigger("template");
        } else {
            if (frm.fields_dict.items_display) {
            frm.fields_dict.items_display.set_value("");
            setTimeout(() => {
                $(frm.fields_dict.items_display.wrapper)
                .find('.add-new-row')
                .on('click', function() {
                    frappe.msgprint(__("Please select a template first to define items, or ensure items are present in the child table."));
                });
            }, 100);
            }
        }

        if(frm.doc.docstatus == 1) {
            $(".add-new-row").hide();
            // Disable all input fields in the transposed table
            $(frm.fields_dict.items_display.wrapper)
                .find('input[type="number"], select')
                .prop('disabled', true);
            $(frm.fields_dict.items_display.wrapper)
                .find('.remove-row')
                .hide();
        }
    },

    template(frm) {
        if (frm.doc.template) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Service Items Transfer Template",
                    name: frm.doc.template
                },
                callback: function(r) {
                    if (r.message) {
                        frm.clear_table("items");
                        frm.set_value("from_warehouse", r.message.from_warehouse);

                        // Build transposed table
                        let items_html = "<table class='table table-bordered'><thead><tr><th>Item (UOM)</th>";
                        for (let warehouse of r.message.warehouses) {
                            items_html += `<th>${warehouse.warehouse}</th>`;
                        }
                        items_html += "<th><i class='fa fa-trash'></i></th></tr></thead><tbody>";

                        for (let item of r.message.items) {
                            items_html += `<tr data-item="${item.item}"><td>${item.item} (${item.uom})</td>`;
                            for (let warehouse of r.message.warehouses) {
                                items_html += `<td><input type="number" min="0" class="form-control" data-warehouse="${warehouse.warehouse}" data-item="${item.item}" style="width:80px;" value="0" /></td>`;
                            }
                            items_html += `<td><button type="button" class="btn btn-danger btn-sm remove-row"><i class="fa fa-trash"></i></button></td>`;
                            items_html += "</tr>";

                            // Add new row for each item in the items table (for all warehouses)
                            for (let warehouse of r.message.warehouses) {
                                let row = frm.add_child("items");
                                row.to_warehouse = warehouse.warehouse;
                                row.item = item.item;
                                row.uom = item.uom;
                                row.qty = 0; // Default quantity
                            }
                        }
                        frm.refresh_field("items");

                        // Add a row for the "Add New" button
                        items_html += `<tr><td colspan="${r.message.warehouses.length + 2}" class="text-center">
                            <button type="button" class="btn btn-success btn-sm add-new-row">
                                <i class="fa fa-plus"></i> Add New Row
                            </button>
                        </td></tr>`;

                        items_html += "</tbody></table>";
                        frm.fields_dict.items_display.set_value(items_html);

                        // Set up event listeners using our helper function
                        setupTransposedTableEventListeners(frm, r.message);
                    }
                }
            });
        }
    }
});
