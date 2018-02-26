import * as d3 from 'd3';
import crossfilter from 'crossfilter';
import barChart from './bar.js';
import 'jquery';
import Popper from 'popper.js';
import 'bootstrap';
import './scss/main.scss';
import './fa/fontawesome-all.js';

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

function showPage(start_date, end_date) {
    let datesForm = $('#dates_form');
    datesForm.find('[name=start_date]').val(start_date);
    datesForm.find('[name=end_date]').val(end_date);
    $("#charts").hide();
    $("#wip").show();
    getJson(start_date, end_date).then(trips => {
        $("#charts").show();
        $("#wip").hide();
        window.setTimeout(() => renderCharts(trips), 0);
    });
}

function renderCharts(trips) {
    // Various formatters.
    const formatNumber = d3.format(',d');

    const formatChange = d3.format('+,d');
    const formatDate = d3.timeFormat('%d/%m/%Y');
    const formatTime = d3.timeFormat('%I:%M %p');
    const DAYS_OF_WEEK = [
        'ראשון',
        'שני',
        'שלישי',
        'רביעי',
        'חמישי',
        'שישי',
        'שבת',
    ];

    const formatDayOfWeek = dow => DAYS_OF_WEEK[dow];
    // A nest operator, for grouping the flight list.
    const nestByDate = d3.nest()
        .key(d => d3.timeDay(d.date));

    let minDate = parseDate(trips[0].date);
    let maxDate = parseDate(trips[0].date);

    // A little coercion, since the CSV is untyped.
    trips.forEach((d, i) => {
        d.index = i;
        d.date = parseDate(d.date);
        if (d.date.getTime() > maxDate.getTime()) {
            maxDate = d.date;
        }
        if (d.date.getTime() < minDate.getTime()) {
            minDate = d.date;
        }
    });

    // Create the crossfilter for the relevant dimensions and groups.
    const tripsCf = crossfilter(trips);

    const all = tripsCf.groupAll();
    const date = tripsCf.dimension(d => d.date);
    const dates = date.group(d3.timeDay);
    const hour = tripsCf.dimension(d => d.x_hour_local);
    const hours = hour.group();
    // Sunday is zero
    const weekDay = tripsCf.dimension(d => d.x_week_day_local);
    const weekDays = weekDay.group();

    const stationDim = tripsCf.dimension(d => d.samples_count);
    const stationGroup = stationDim.group();
    const maxStations = trips.map(x => x.samples_count).reduce((x, y) => Math.max(x, y));

    const delayFieldsNames = ['x_last_delay_arrival', 'x_max_delay_arrival', 'x_avg_delay_arrival'];
    let delayFields = [];
    const minDelay = -300;
    const maxDelay = 600;
    for (let delayFieldName of delayFieldsNames) {
        let dim = tripsCf.dimension(d => d[delayFieldName]);
        let group = dim.group(d => {
            let d2 = Math.max(minDelay, Math.min(maxDelay, d));
            return Math.floor(d2 / 6) / 10
        });
        delayFields.push({
            dim: dim,
            group: group,
            fieldName: delayFieldName
        });
    }


    const delayCharts = delayFields.map(delayField =>
        barChart()
            .callback(renderAll)
            .dimension(delayField.dim)
            .group(delayField.group)
            .x(d3.scaleLinear()
                .domain([minDelay / 60, 1 + (maxDelay / 60)]))
            .domainCount(150));

    const charts = delayCharts.concat([
        barChart()
            .callback(renderAll)
            .dimension(hour)
            .group(hours)
            .x(d3.scaleLinear()
                .domain([0, 24])),

        barChart()
            .callback(renderAll)
            .dimension(weekDay)
            .group(weekDays)
            .x(d3.scaleLinear()
                .domain([0, 7])),

        barChart()
            .callback(renderAll)
            .dimension(stationDim)
            .group(stationGroup)
            .x(d3.scaleLinear()
                .domain([0, maxStations])),

        barChart()
            .callback(renderAll)
            .dimension(date)
            .group(dates)
            .round(d3.timeDay.round)
            .x(d3.scaleTime()
                .domain([minDate, maxDate]))
            .domainCount(d3.scaleTime()
                .domain([minDate, maxDate]).ticks(d3.timeDay.every(1)).length)

    ]);

    // Given our array of charts, which we assume are in the same order as the
    // .chart elements in the DOM, bind the charts to the DOM and render them.
    // We also listen to the chart's brush events to update the display.c
    const chart = d3.selectAll('.chart')
        .data(charts);

    // Render the initial lists.
    const list = d3.selectAll('#trip-list')
        .data([tripList]);

    // Render the total.
    d3.selectAll('#total')
        .text(formatNumber(tripsCf.size()));

    renderAll();

    // Renders the specified chart or list.
    function render(method) {
        d3.select(this).call(method);
    }

    // Whenever the brush moves, re-rendering everything.
    function renderAll() {
        chart.each(render);
        list.each(render);
        d3.select('#active').text(formatNumber(all.value()));
    }

    $(window).resize(() => {
        $('.chart svg').remove();
        renderAll();
    });

    // Like d3.timeFormat, but faster.
    function parseDate(d) {
        let [year, month, day] = d.split("-").map(x => parseInt(x));
        return new Date(year, month - 1, day);
    }

    window.filter = filters => {
        filters.forEach((d, i) => {
            charts[i].filter(d);
        });
        renderAll();
    };

    window.reset = i => {
        charts[i].filter(null);
        renderAll();
    };

    function tripList(div) {

        const tripsToShow = delayFields[0].dim.top(40);
        div.each(function () {

            const trip = div.selectAll('.trip')
                .data(tripsToShow);

            trip.exit().remove();

            const tripEnter = trip.enter().append('tr').attr("class", "trip");

            tripEnter.append('td')
                .text(d => formatDate(d.date));

            tripEnter.append('td')
                .text(d => d.x_hour_local);

            tripEnter.append('td')
                .text(d => `${formatDayOfWeek(d.x_week_day_local)}`);

            tripEnter.append('td')
                .classed('early', d => d.x_avg_delay_arrival < 0)
                .text(d => `${formatChange(d.x_avg_delay_arrival / 60)}` + ' ' + 'דקות');

            tripEnter.merge(trip);

            trip.order();
        });
    }
}

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

$(function () {
    let params = getParams(window.location.search);
    showPage(params.start_date || "2017-10-01", params.end_date || "2017-10-31");
});

