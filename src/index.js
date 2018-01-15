import * as d3 from 'd3';
import crossfilter from 'crossfilter';
/* global d3 crossfilter reset */

// (It's CSV, but GitHub Pages only gzip's JSON at the moment.)
d3.json('data/trips_2017_10.json', (error, trips) => {
    console.log(trips.length);

    // Various formatters.
    const formatNumber = d3.format(',d');

    const formatChange = d3.format('+,d');
    const formatDate = d3.timeFormat('%B %d, %Y');
    const formatTime = d3.timeFormat('%I:%M %p');

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
    const avgDelay = tripsCf.dimension(d => Math.max(minDelay, Math.min(maxDelay, d.x_avg_delay_arrival)));
    const avgDelays = avgDelay.group(d => Math.floor(d / 60));

    const charts = [

        barChart()
            .dimension(hour)
            .group(hours)
            .x(d3.scaleLinear()
                .domain([0, 24])
                .rangeRound([0, 10 * 24])),

        barChart()
            .dimension(weekDay)
            .group(weekDays)
            .x(d3.scaleLinear()
                .domain([0, 10])
                .rangeRound([0, 10 * 10])),

        barChart()
            .dimension(avgDelay)
            .group(avgDelays)
            .x(d3.scaleLinear()
                .domain([minDelay / 60 , 1+ (maxDelay / 60)])
                .rangeRound([0, 10 * Math.floor((maxDelay - minDelay) / 60)])),


        barChart()
            .dimension(date)
            .group(dates)
            .round(d3.timeDay.round)
            .x(d3.scaleTime()
                .domain([minDate, maxDate])
                .rangeRound([0, 10 * 90]))

    ];

    // Given our array of charts, which we assume are in the same order as the
    // .chart elements in the DOM, bind the charts to the DOM and render them.
    // We also listen to the chart's brush events to update the display.c
    const chart = d3.selectAll('.chart')
        .data(charts);

    // Render the initial lists.
    const list = d3.selectAll('.list')
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
        return new Date(year,month,day);
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
        // const tripsByDate = nestByDate.entries(date.top(40));
        //
        // div.each(function () {
        //     const date = d3.select(this).selectAll('.date')
        //         .data(tripsByDate, d => d.key);
        //
        //     date.exit().remove();
        //
        //     date.enter().append('div')
        //         .attr('class', 'date')
        //         .append('div')
        //         .attr('class', 'day')
        //         .text(d => formatDate(d.values[0].date))
        //         .merge(date);
        //
        //
        //     const flight = date.order().selectAll('.flight')
        //         .data(d => d.values, d => d.index);
        //
        //     flight.exit().remove();
        //
        //     const flightEnter = flight.enter().append('div')
        //         .attr('class', 'flight');
        //
        //     flightEnter.append('div')
        //         .attr('class', 'time')
        //         .text(d => formatTime(d.date));
        //
        //     flightEnter.append('div')
        //         .attr('class', 'origin')
        //         .text(d => d.origin);
        //
        //     flightEnter.append('div')
        //         .attr('class', 'destination')
        //         .text(d => d.destination);
        //
        //     flightEnter.append('div')
        //         .attr('class', 'distance')
        //         .text(d => `${formatNumber(d.distance)} mi.`);
        //
        //     flightEnter.append('div')
        //         .attr('class', 'delay')
        //         .classed('early', d => d.delay < 0)
        //         .text(d => `${formatChange(d.delay)} min.`);
        //
        //     flightEnter.merge(flight);
        //
        //     flight.order();
        // });
    }

    function barChart() {
        if (!barChart.id) barChart.id = 0;

        let margin = { top: 10, right: 13, bottom: 20, left: 10 };
        let x;
        let y = d3.scaleLinear().range([100, 0]);
        const id = barChart.id++;
        const axis = d3.axisBottom();
        const brush = d3.brushX();
        let brushDirty;
        let dimension;
        let group;
        let round;
        let gBrush;

        function chart(div) {
            const width = x.range()[1];
            const height = y.range()[0];

            brush.extent([[0, 0], [width, height]]);

            y.domain([0, group.top(1)[0].value]);

            div.each(function () {
                const div = d3.select(this);
                let g = div.select('g');

                // Create the skeletal chart.
                if (g.empty()) {
                    div.select('.title').append('a')
                        .attr('href', `javascript:reset(${id})`)
                        .attr('class', 'reset')
                        .text('reset')
                        .style('display', 'none');

                    g = div.append('svg')
                        .attr('width', width + margin.left + margin.right)
                        .attr('height', height + margin.top + margin.bottom)
                        .append('g')
                        .attr('transform', `translate(${margin.left},${margin.top})`);

                    g.append('clipPath')
                        .attr('id', `clip-${id}`)
                        .append('rect')
                        .attr('width', width)
                        .attr('height', height);

                    g.selectAll('.bar')
                        .data(['background', 'foreground'])
                        .enter().append('path')
                        .attr('class', d => `${d} bar`)
                        .datum(group.all());

                    g.selectAll('.foreground.bar')
                        .attr('clip-path', `url(#clip-${id})`);

                    g.append('g')
                        .attr('class', 'axis')
                        .attr('transform', `translate(0,${height})`)
                        .call(axis);

                    // Initialize the brush component with pretty resize handles.
                    gBrush = g.append('g')
                        .attr('class', 'brush')
                        .call(brush);

                    gBrush.selectAll('.handle--custom')
                        .data([{ type: 'w' }, { type: 'e' }])
                        .enter().append('path')
                        .attr('class', 'brush-handle')
                        .attr('cursor', 'ew-resize')
                        .attr('d', resizePath)
                        .style('display', 'none');
                }

                // Only redraw the brush if set externally.
                if (brushDirty !== false) {
                    const filterVal = brushDirty;
                    brushDirty = false;

                    div.select('.title a').style('display', d3.brushSelection(div) ? null : 'none');

                    if (!filterVal) {
                        g.call(brush);

                        g.selectAll(`#clip-${id} rect`)
                            .attr('x', 0)
                            .attr('width', width);

                        g.selectAll('.brush-handle').style('display', 'none');
                        renderAll();
                    } else {
                        const range = filterVal.map(x);
                        brush.move(gBrush, range);
                    }
                }

                g.selectAll('.bar').attr('d', barPath);
            });

            function barPath(groups) {
                const path = [];
                let i = -1;
                const n = groups.length;
                let d;
                while (++i < n) {
                    d = groups[i];
                    path.push('M', x(d.key), ',', height, 'V', y(d.value), 'h9V', height);
                }
                return path.join('');
            }

            function resizePath(d) {
                const e = +(d.type === 'e');
                const x = e ? 1 : -1;
                const y = height / 3;
                return `M${0.5 * x},${y}A6,6 0 0 ${e} ${6.5 * x},${y + 6}V${2 * y - 6}A6,6 0 0 ${e} ${0.5 * x},${2 * y}ZM${2.5 * x},${y + 8}V${2 * y - 8}M${4.5 * x},${y + 8}V${2 * y - 8}`;
            }
        }

        brush.on('start.chart', function () {
            const div = d3.select(this.parentNode.parentNode.parentNode);
            div.select('.title a').style('display', null);
        });

        brush.on('brush.chart', function () {
            const g = d3.select(this.parentNode);
            const brushRange = d3.event.selection || d3.brushSelection(this); // attempt to read brush range
            const xRange = x && x.range(); // attempt to read range from x scale
            let activeRange = brushRange || xRange; // default to x range if no brush range available

            const hasRange = activeRange &&
                activeRange.length === 2 &&
                !isNaN(activeRange[0]) &&
                !isNaN(activeRange[1]);

            if (!hasRange) return; // quit early if we don't have a valid range

            // calculate current brush extents using x scale
            let extents = activeRange.map(x.invert);

            // if rounding fn supplied, then snap to rounded extents
            // and move brush rect to reflect rounded range bounds if it was set by user interaction
            if (round) {
                extents = extents.map(round);
                activeRange = extents.map(x);

                if (
                    d3.event.sourceEvent &&
                    d3.event.sourceEvent.type === 'mousemove'
                ) {
                    d3.select(this).call(brush.move, activeRange);
                }
            }

            // move brush handles to start and end of range
            g.selectAll('.brush-handle')
                .style('display', null)
                .attr('transform', (d, i) => `translate(${activeRange[i]}, 0)`);

            // resize sliding window to reflect updated range
            g.select(`#clip-${id} rect`)
                .attr('x', activeRange[0])
                .attr('width', activeRange[1] - activeRange[0]);

            // filter the active dimension to the range extents
            dimension.filterRange(extents);

            // re-render the other charts accordingly
            renderAll();
        });

        brush.on('end.chart', function () {
            // reset corresponding filter if the brush selection was cleared
            // (e.g. user "clicked off" the active range)
            if (!d3.brushSelection(this)) {
                reset(id);
            }
        });

        chart.margin = function (_) {
            if (!arguments.length) return margin;
            margin = _;
            return chart;
        };

        chart.x = function (_) {
            if (!arguments.length) return x;
            x = _;
            axis.scale(x);
            return chart;
        };

        chart.y = function (_) {
            if (!arguments.length) return y;
            y = _;
            return chart;
        };

        chart.dimension = function (_) {
            if (!arguments.length) return dimension;
            dimension = _;
            return chart;
        };

        chart.filter = _ => {
            if (!_) dimension.filterAll();
            brushDirty = _;
            return chart;
        };

        chart.group = function (_) {
            if (!arguments.length) return group;
            group = _;
            return chart;
        };

        chart.round = function (_) {
            if (!arguments.length) return round;
            round = _;
            return chart;
        };

        chart.gBrush = () => gBrush;

        return chart;
    }
});