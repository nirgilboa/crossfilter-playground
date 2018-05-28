import * as d3 from 'd3';
import bb from "billboard.js";
import crossfilter from 'crossfilter';
import 'jquery';
import Popper from 'popper.js';
import 'bootstrap';
import './scss/main.scss';
import './fa/fontawesome-all.js';

import {DelayField, DateField, StopsCountField, WeekDayField, HoursField} from './fields.js'

function parseDate(d) {
    let [year, month, day] = d.split("-").map(x => parseInt(x));
    return new Date(year, month - 1, day);
}


function toMap(items, getter) {
    let result = new Map();
    for (let item of items) {
        result.set(getter(item), item);
    }
    return result;
}

function getJson(startDate, endDate) {
    return new Promise((resolve, reject) => {
        let lastStartDate = localStorage.getItem("lastCallStartData");
        let lastEndDate = localStorage.getItem("lastCallEndData");
        if (lastStartDate === startDate && lastEndDate === endDate) {
            let lastTrips = localStorage.getItem("lastCallTrips");
            if (lastTrips) {
                resolve(JSON.parse(lastTrips));
            }
        }
        let url = `http://otrain.org/api/v1/trips/compact/?start_date=${startDate}&end_date=${endDate}`;
        $.ajax(url).then(data => {
            localStorage.setItem("lastCallStartData", startDate);
            localStorage.setItem("lastCallEndData", endDate);
            localStorage.setItem("lastCallTrips", JSON.stringify(data));
            resolve(data);
        }, hideWipShowError);
    });
}

function hideWipShowError(resp, textStatus, errorThrown) {
    $("#wip").hide();
    $("#error-text").text(
        "שגיאה: "
        + resp.status
    );
    $("#error-div").show();
}

function showPage(startDate, endDate) {
    let datesForm = $('#dates_form');
    datesForm.find('[name=start_date]').val(startDate);
    datesForm.find('[name=end_date]').val(endDate);
    $("#charts").hide();
    $("#wip").show();
    getJson(startDate, endDate).then(trips => {
        $("#charts").show();
        $("#wip").hide();
        window.setTimeout(
            () => renderCharts(trips),
            0);
    });
}



class Manager {
    constructor(trips) {
        this.trips = trips;
        this.cf = crossfilter(trips);
        let all = this.cf.groupAll();
    }

    refreshCharts() {
        $("#total_count").text(this.trips.length);
        for (let field of this.fields) {
            field.applyFilter();
        }

        for (let field of this.fields) {
            field.renderChart();
        }


    }
    setFields(fields) {
        this.fields = fields;
        this.fieldsByCode = {};
        for (let f of this.fields) {
            this.fieldsByCode[f.code] = f;
        }
    }
}

function renderCharts(trips) {
    // A little coercion, since the CSV is untyped.
    trips.forEach((d, i) => {
        d.index = i;
        d.date = parseDate(d.date);
    });

    let m = new Manager(trips);
    window.m = m;
    let fields = [];
    for (let df of [
        ['איחור בתחנה אחרונה', 'x_last_delay_arrival'],
        ['איחור מקסימלי', 'x_max_delay_arrival'],
        ['איחור ממוצע', 'x_avg_delay_arrival']
        ]) {
        fields.push(new DelayField(m, df[0], df[1]))
    }
    fields = fields.concat([
         new HoursField(m, 'שעת יציאה', 'hour', d => d.x_hour_local),
        // Sunday is zero
         new WeekDayField(m, 'יום בשבוע', 'weekDay', d => d.x_week_day_local),
         new StopsCountField(m, 'מספר תחנות','stopsCount', d => d.samples_count),
         new DateField(m, 'תאריך','date', d => d3.timeDay(d.date).getTime()),
    ]);

    m.setFields(fields);

    for (let field of fields) {
        field.build();
    }


    let row = $("#charts-row");
    for (let field of fields) {
        let html = field.getHtml();
        //console.log(html);
        row.append(html);
    }

    m.refreshCharts();

    $("body").on("click",".reset-chart", function() {
        let code = $(this).closest("[data-code]").data("code");
        m.fieldsByCode[code].reset();
   });

}

$(function () {
    const getParams = query => {
    if (!query) {
        return {};
    }

    return (/^[?#]/.test(query) ? query.slice(1) : query)
        .split('&')
        .reduce((params, param) => {
            let [key, value] = param.split('=');
            params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
            return params;
        }, {});
    };
    let params = getParams(window.location.search);
    showPage(params.start_date || "2017-10-01", params.end_date || "2017-10-31");
});


