import * as d3 from "d3";

export default function barChart() {
    if (!barChart.id) barChart.id = 0;

    let margin = {top: 10, right: 13, bottom: 20, left: 10};
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
    let callback;
    let colWidth;
    let width;
    let height;
    let domainCount;

    function chart(div) {
        refreshSize(div);

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
                    .text('(איפוס)')
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
                    .data([{type: 'w'}, {type: 'e'}])
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
                    if (callback) {
                        callback();
                    }
                } else {
                    const range = filterVal.map(x);
                    brush.move(gBrush, range);
                }
            }

            g.selectAll('.bar').attr('d', barPath);
        });

        function refreshSize(div) {
            width = div.node().getBoundingClientRect().width - margin.left - margin.right;
            height = y.range()[0];
            if (!domainCount) {
                domainCount = (x.domain()[1] - x.domain()[0]);
            }
            colWidth = width / domainCount;
        }

        function barPath(groups) {
            const path = [];
            let i = -1;
            const n = groups.length;
            let d;
            while (++i < n) {
                d = groups[i];
                path.push('M', x(d.key) * width, ',', height, 'V', y(d.value), `h${colWidth-1}V`, height);
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
        if (callback) {
            callback();
        }
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

    chart.callback = function(_) {
        callback = _;
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

    chart.domainCount = function (_) {
        if (!arguments.length) return domainCount;
        domainCount = _;
        return chart;
    };

    chart.gBrush = () => gBrush;

    return chart;
}