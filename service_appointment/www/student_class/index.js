async function get_student_class() {
    let cpr = document.getElementById('cpr').value;
    if(!cpr) {
        frappe.msgprint( "الرجاء ادخال الرقم الشخصي أولاً (بالأرقام الانجليزية)", "خطأ");
        return false;
    }
    let student_class = (await frappe.call({
        method: 'erpnext.www.student_class.index.get_student_class',
        args: {
            cpr: cpr
        }
    })).message;
}

frappe.ready(async () => {
    $('#footer-subscribe-email').remove();
    $('#footer-subscribe-button').remove();
    $('.web-footer').remove();
    $('.navbar').remove();
});