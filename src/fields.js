import bb from "billboard.js";
import * as d3 from "d3";
import {kvsToObject} from "./utils";

class Field {
    constructor(m, title, code, getter) {
        this.manager = m;
        this.title = title;
        this.code = code;
        this.getter = getter;
        this.data = null;
        this.selectedKeys = new Set();
    }

    get cf() {
        return this.manager.cf;
    }

    build() {
        this.dim = this.cf.dimension(this.getter);
        this.group = this.dim.group();
    }


    getWidth() {
        return 4;
    }

    getHtml() {
        let title = this.title;
        let width = this.getWidth();
        // console.log(title);
        return `
            <div class="col-sm-${width} chart-wrapper" data-code="${this.code}">
                <div class="card">
                    <div class="chart-header">
                        ${title}
                        - 
                        מציג
                        <span class="dim-count"></span>
                        נסיעות
                        <span class="float-right">
                            <span class="pointer reset-chart" title="בטל את כל הבחירות" style="display: none">
                                <i class="fas fa-times-circle"></i>
                            </span>
                        </span>
                    </div>
                    <div class="chart" id=${this.htmlId}>
                    </div>
                </div>
            </div>`;
    }

    get htmlId() {
        return `field_${this.code}`;
    }

    get selector() {
        return '#' + this.htmlId;
    }

    buildData() {
        let groups = this.group.all();
        let result = this.getData(groups);
        return result;
    }

    getData(groups) {
        throw "Must Implement"
    }

    onClick(d) {
        // console.log(d);
        let key = this.data[d.index].key;
        if (this.selectedKeys.has(key)) {
            this.selectedKeys.delete(key);
        }
        else {
            this.selectedKeys.add(key);
        }
        this.manager.refreshCharts();
        //console.log(this.selectedKeys);
    }

    reset() {
        this.selectedKeys.clear();
        this.manager.refreshCharts();
    }

    getColor(color, d) {
        if (d.index !== undefined) {
            let key = this.data[d.index].key;
            if (this.selectedKeys.has(key)) {
                return "red";
            }
        }
        return color;
    }

    applyFilter(){
        //console.log(this.selectedKeys);
        let is = d => {
            if (this.selectedKeys.size === 0) {
                return true;
            }
            return this.selectedKeys.has(d)
        }
        this.dim.filter(d => is(d));
    }

    renderChart() {
        this.data = this.buildData();

        $(`[data-code=${this.code}] .reset-chart`).toggle(this.selectedKeys.size > 0);
        let dimCount = this.dim.groupAll().value();
        $(`[data-code=${this.code}] .dim-count`).text(dimCount);
        if (this.chart)
            this.chart.destroy();
        let options = {
            bindto: this.selector,
            data: {
                type: "bar",
                onclick: (d, element) => {this.onClick(d);},
                color: (color, d) => this.getColor(color, d),
                columns: [
                    ["נסיעות", ...this.data.map(kv=>kv.value)]
                ]
            },
            axis: {
                x: {
                    type: 'category',
                    categories: this.data.map(kv=>kv.name),
                    tick: {
                        culling: true,
                        multiline: false,
                    }
                }
            }
        };
        // console.log(options);
        this.chart = bb.generate(options);
    }
}

export class WeekDayField extends Field {
    getData(kvs) {
        const DAYS_OF_WEEK = [
        'ראשון',
        'שני',
        'שלישי',
        'רביעי',
        'חמישי',
        'שישי',
        'שבת',
        ];

        let result = [];
        let kvsObj = kvsToObject(kvs);
        for (let wd = 0 ; wd < 7 ; wd++) {
            result.push({
                'key': wd,
                'value': kvsObj[wd] || 0,
                'name': DAYS_OF_WEEK[wd]
            })
        }
        return result;
    }
}

export class DateField extends Field {
    getData(kvs) {
        return kvs.map(kv=> {
            let d = new Date(kv.key);
            return {
                'key': kv.key,
                'value': kv.value,
                'name': `${d.getDate()}/${1+d.getMonth()}/${d.getFullYear()}`,
            }
        })
    }
    getWidth() {
        return 12;
    }
}

export class DelayField extends Field {
    constructor(m, title, code) {
        super(m, title, code, x=>this.getDelay(x))
        this.minDelay = -120;
        this.maxDelay = +600;
        this.step = 12;
    }

    getDelay(x) {
        let d = x[this.code];
        let min = this.minDelay;
        let max = this.maxDelay;
        d = Math.max(min, d);
        d = Math.min(max, d);
        let result = d - (this.step+(d % this.step))%this.step;
        if (result > this.maxDelay || result < this.minDelay) {
            throw `illegal result d = ${d} result = ${result}`;
        }
        return result;
    }



    getData(kvs) {
        let kvsObj = kvsToObject(kvs);
        let result = [];
        for (let sec = this.minDelay ; sec <= this.maxDelay ; sec+=this.step) {
            result.push({
                    'key': sec,
                    'name': `${sec / 60}`,
                    'value': kvsObj[sec] || 0,
                });
        }
        return result;
    }
}

export class HoursField extends Field {
    getData(kvs) {
        let name = h => {
            let h2 = h < 10 ? "0" + h : "" + h;
            return `${h2}:00-${h2}:59`;
        };
        for (let kv of kvs) {
            if (kv.key < 0 || kv.key > 23) {
                throw "Problem with key " + kv.key;
            }
        }
        let kvsObj = kvsToObject(kvs);
        let result = [];
        for (let h = 0 ; h <= 23; h++) {
            result.push({
                    'key': h,
                    'name': name(h),
                    'value': kvsObj[h] || 0,
                });
        }
        return result;
    }
}

export class StopsCountField extends Field {
    getData(kvs) {
        let result = [];
        for (let kv of kvs) {
            result.push({
                'key': kv.key,
                'value': kv.value,
                'name': '' + kv.key
            })
        }
        return result;
    }
}
