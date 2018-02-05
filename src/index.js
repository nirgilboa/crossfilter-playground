import * as d3 from 'd3';
import crossfilter from 'crossfilter';
import barChart from './bar.js';
import 'jquery';
import Popper from 'popper.js';
import 'bootstrap';
import './scss/main.scss';


/* global d3 crossfilter reset */

// (It's CSV, but GitHub Pages only gzip's JSON at the moment.)
d3.json('data/trips_2017_10.json', (error, trips) => {
    console.log(trips.length);
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
    const minDelay = -300;
    const maxDelay = 600;
    const avgDelay = tripsCf.dimension(d => d.x_avg_delay_arrival);
    const avgDelays = avgDelay.group(d => {
        let d2 = Math.max(minDelay, Math.min(maxDelay, d));
        return Math.floor(d2 / 6) / 10
    });

    // window.avgDelay = avgDelay;
    const charts = [

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
            .dimension(avgDelay)
            .group(avgDelays)
            .x(d3.scaleLinear()
                .domain([minDelay / 60 , 1+ (maxDelay / 60)])),

        barChart()
            .callback(renderAll)
            .dimension(date)
            .group(dates)
            .round(d3.timeDay.round)
            .x(d3.scaleTime()
                .domain([minDate, maxDate]))
            .domainCount(d3.scaleTime()
                .domain([minDate, maxDate]).ticks(d3.timeDay.every(1)).length)

    ];

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

    // Like d3.timeFormat, but faster.
    function parseDate(d) {
        let [year, month, day] = d.split("-").map(x=>parseInt(x));
        return new Date(year,month-1,day);
    }

    window.filter = filters => {
        filters.forEach((d, i) => { charts[i].filter(d); });
        renderAll();
    };

    window.reset = i => {
        charts[i].filter(null);
        renderAll();
    };

    function tripList(div) {

        const tripsToShow = avgDelay.top(40);
        div.each(function () {

            const trip = div.selectAll('.trip')
                .data(tripsToShow);

            trip.exit().remove();

            const tripEnter = trip.enter().append('tr').attr("class","trip");

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
});

