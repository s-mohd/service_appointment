import frappe
import datetime
import json
import pytz


no_cache = 1


def get_context(context):
	return context

@frappe.whitelist(allow_guest=True)
def get_student_class(cpr=''):
	if cpr:
		student = frappe.get_all('Student', fields=['first_name', 'student_group', 'registration_status'], filters={"cpr": cpr})
		if student:
			group_1 = """
			<style type="text/css">
				body,div,table,thead,tbody,tfoot,tr,th,td,p { font-family:"Calibri"; font-size:small }
				a.comment-indicator:hover + comment { background:#ffd; position:absolute; display:block; border:1px solid black; padding:0.5em;  } 
				a.comment-indicator { background:red; display:inline-block; border:1px solid black; width:0.5em; height:0.5em;  } 
				comment { display:none;  } 
			</style>
			<table cellspacing="0" border="0" style="direction: rtl;">
				<colgroup width="86"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="120"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="140"></colgroup>
				<tr>
					<td style="border-bottom: 2px solid #000000; border-right: 2px solid #000000" rowspan=2 height="57" align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" align="center" valign=middle bgcolor="#FFF2CC"><b><font face="DejaVu Sans" size=4 color="#000000">&#1575;&#1604;&#1587;&#1604;&#1575;&#1605; &#1575;&#1604;&#1605;&#1604;&#1603;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="1" sdnum="1033;"><b><font size=4 color="#000000">1</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="2" sdnum="1033;"><b><font size=4 color="#000000">2</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle bgcolor="#FFF2CC"><b><font face="DejaVu Sans" size=4 color="#000000">&#1601;&#1587;&#1581;&#1577; 1</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="3" sdnum="1033;"><b><font size=4 color="#000000">3</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="4" sdnum="1033;"><b><font size=4 color="#000000">4</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle bgcolor="#FFF2CC"><b><font face="DejaVu Sans" size=4 color="#000000">&#1601;&#1587;&#1581;&#1577; 2</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="5" sdnum="1033;"><b><font size=4 color="#000000">5</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="6" sdnum="1033;"><b><font size=4 color="#000000">6</font></b></td>
					</tr>
				<tr>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" align="center" valign=middle><b><font size=4 color="#000000">7:30 - 7:15</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">8:20 - 7:30</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">9:25 - 8:35</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle><b><font size=4 color="#000000">9:55 - 9:25</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">10:45 - 9:55</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">11:50 - 11:00</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle><b><font size=4 color="#000000">12:20 - 11:50</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">1:10 - 12:20</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">2:15 - 1:25</font></b></td>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1571;&#1581;&#1583;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#EDF181"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#767171"><b><font face="DejaVu Sans" color="#000000">&#1605;&#1580;&#1575;&#1604;&#1575;&#1578; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C39DC3"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1580;&#1578;&#1605;&#1575;&#1593;&#1610;&#1575;&#1578; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1575;&#1579;&#1606;&#1610;&#1606;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#F8CBAD"><b><font face="DejaVu Sans" color="#000000">&#1578;&#1585;&#1576;&#1610;&#1577; &#1573;&#1587;&#1604;&#1575;&#1605;&#1610;&#1577;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#EDF181"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#8FAADC"><b><font face="DejaVu Sans" color="#000000">&#1581;&#1575;&#1587;&#1576; &#1608;&#1571;&#1587;&#1585;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FF3443"><b><font face="DejaVu Sans" color="#000000">&#1605;&#1608;&#1575;&#1591;&#1606;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1579;&#1604;&#1575;&#1579;&#1575;&#1569;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C39DC3"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1580;&#1578;&#1605;&#1575;&#1593;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#8FAADC"><b><font face="DejaVu Sans" color="#000000">&#1581;&#1575;&#1587;&#1576; &#1608;&#1571;&#1587;&#1585;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#F8CBAD"><b><font face="DejaVu Sans" color="#000000">&#1578;&#1585;&#1576;&#1610;&#1577; &#1573;&#1587;&#1604;&#1575;&#1605;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1571;&#1585;&#1576;&#1593;&#1575;&#1569;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1582;&#1605;&#1610;&#1587;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=5 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#F8CBAD"><b><font face="DejaVu Sans" color="#000000">&#1578;&#1585;&#1576;&#1610;&#1577; &#1573;&#1587;&#1604;&#1575;&#1605;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
			</table>
			"""

			group_2 = """
			<style type="text/css">
				body,div,table,thead,tbody,tfoot,tr,th,td,p { font-family:"Calibri"; font-size:small }
				a.comment-indicator:hover + comment { background:#ffd; position:absolute; display:block; border:1px solid black; padding:0.5em;  } 
				a.comment-indicator { background:red; display:inline-block; border:1px solid black; width:0.5em; height:0.5em;  } 
				comment { display:none;  } 
			</style>
			<table cellspacing="0" border="0" style="direction: rtl;">
				<colgroup width="86"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="120"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="100"></colgroup>
				<colgroup width="140"></colgroup>
				<tr>
					<td style="border-bottom: 2px solid #000000; border-right: 2px solid #000000" rowspan=2 height="57" align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" align="center" valign=middle bgcolor="#FFF2CC"><b><font face="DejaVu Sans" size=4 color="#000000">&#1575;&#1604;&#1587;&#1604;&#1575;&#1605; &#1575;&#1604;&#1605;&#1604;&#1603;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="1" sdnum="1033;"><b><font size=4 color="#000000">1</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="2" sdnum="1033;"><b><font size=4 color="#000000">2</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle bgcolor="#FFF2CC"><b><font face="DejaVu Sans" size=4 color="#000000">&#1601;&#1587;&#1581;&#1577; 1</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="3" sdnum="1033;"><b><font size=4 color="#000000">3</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="4" sdnum="1033;"><b><font size=4 color="#000000">4</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle bgcolor="#FFF2CC"><b><font face="DejaVu Sans" size=4 color="#000000">&#1601;&#1587;&#1581;&#1577; 2</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="5" sdnum="1033;"><b><font size=4 color="#000000">5</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 align="center" valign=middle bgcolor="#FFF2CC" sdval="6" sdnum="1033;"><b><font size=4 color="#000000">6</font></b></td>
					</tr>
				<tr>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" align="center" valign=middle><b><font size=4 color="#000000">7:30 - 7:15</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">8:20 - 7:30</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">9:25 - 8:35</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle><b><font size=4 color="#000000">9:55 - 9:25</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">10:45 - 9:55</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">11:50 - 11:00</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" align="center" valign=middle><b><font size=4 color="#000000">12:20 - 11:50</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">1:10 - 12:20</font></b></td>
					<td style="border-top: 1px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 align="center" valign=middle><b><font size=4 color="#000000">2:15 - 1:25</font></b></td>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1571;&#1581;&#1583;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=25 align="center" valign=bottom><font color="#000000"><br></font></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" rowspan=25 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-right: 1px solid #000000" rowspan=25 align="center" valign=middle><b><font color="#000000"><br></font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C39DC3"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1580;&#1578;&#1605;&#1575;&#1593;&#1610;&#1575;&#1578; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1575;&#1579;&#1606;&#1610;&#1606;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#8FAADC"><b><font face="DejaVu Sans" color="#000000">&#1581;&#1575;&#1587;&#1576; &#1608;&#1571;&#1587;&#1585;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FF3443"><b><font face="DejaVu Sans" color="#000000">&#1605;&#1608;&#1575;&#1591;&#1606;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#F8CBAD"><b><font face="DejaVu Sans" color="#000000">&#1578;&#1585;&#1576;&#1610;&#1577; &#1573;&#1587;&#1604;&#1575;&#1605;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1579;&#1604;&#1575;&#1579;&#1575;&#1569;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1571;&#1585;&#1576;&#1593;&#1575;&#1569;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#F8CBAD"><b><font face="DejaVu Sans" color="#000000">&#1578;&#1585;&#1576;&#1610;&#1577; &#1573;&#1587;&#1604;&#1575;&#1605;&#1610;&#1577;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C39DC3"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1580;&#1578;&#1605;&#1575;&#1593;&#1610;&#1575;&#1578;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#FFE699"><b><font face="DejaVu Sans" color="#000000">&#1585;&#1610;&#1575;&#1590;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" rowspan=5 height="108" align="center" valign=middle><b><font face="DejaVu Sans" color="#000000">&#1575;&#1604;&#1582;&#1605;&#1610;&#1587;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#8FAADC"><b><font face="DejaVu Sans" color="#000000">&#1581;&#1575;&#1587;&#1576; &#1608;&#1571;&#1587;&#1585;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#DBDBDB"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1585;&#1576;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#C5E0B4"><b><font face="DejaVu Sans" color="#000000">&#1575;&#1606;&#1580;&#1604;&#1610;&#1586;&#1610;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#BDD7EE"><b><font face="DejaVu Sans" color="#000000">&#1593;&#1604;&#1608;&#1605;</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 1px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#767171"><b><font face="DejaVu Sans" color="#000000">&#1605;&#1580;&#1575;&#1604;&#1575;&#1578; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					<td style="border-top: 2px solid #000000; border-bottom: 2px solid #000000; border-left: 2px solid #000000; border-right: 2px solid #000000" colspan=2 rowspan=5 align="center" valign=middle bgcolor="#F8CBAD"><b><font face="DejaVu Sans" color="#000000">&#1578;&#1585;&#1576;&#1610;&#1577; &#1573;&#1587;&#1604;&#1575;&#1605;&#1610;&#1577; (&#1576;&#1608;&#1575;&#1576;&#1577;)</font></b></td>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
				<tr>
					</tr>
			</table>
			"""
			
			timetable = ""

			if student[0].student_group[0] == '1':
				timetable = group_1
			elif student[0].student_group[0] == '2':
				timetable = group_2
			
			timetable = ""
			frappe.msgprint(msg="<div style='direction: rtl; text-align:center;'><b>الصف:</b> {}<br><b>طريقة التعلم:</b> {}<br><br> {}</div>".format(student[0].student_group, student[0].registration_status, timetable), title=student[0].first_name)
		else:
			frappe.msgprint(msg="الرجاء التأكد من الرقم الشخصي", title="خطأ")
	else:
		frappe.msgprint(msg="الرجاء ادخال الرقم الشخصي", title="خطأ")