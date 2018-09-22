// ==UserScript==
// @name         gpt-ads.js
// @include      *
// @run-at       document-start
// @require      https://cvazac.netlify.com/gpt-ads/scripts/d3.js
// @require      https://cvazac.netlify.com/gpt-ads/scripts/d3kit.min.js
// @require      https://cvazac.netlify.com/gpt-ads/scripts/labella.min.js
// @require      https://cvazac.netlify.com/gpt-ads/scripts/d3kit-timeline.min.js
// ==/UserScript==

;(function() {
    if (window !== top) return;

    var chart, timers = {}, adTimers = {}, slotId
    timers['navigationStart'] = 0

    initTimers()
    initGptListeners()

    function initTimers() {
        var timers = {}
        timers['navigationStart'] = 0

        window.addEventListener('DOMContentLoaded', function() {
            setTimeout(function(){
                var entry = performance.getEntriesByType('navigation')[0]
//                addTimer('domContentLoadedEventStart', entry.domContentLoadedEventStart)
//                addTimer('domContentLoadedEventEnd', entry.domContentLoadedEventEnd)
                addTimer('domContentLoaded', entry.domContentLoadedEventEnd)
            })
        })

        new PerformanceObserver(function(list, observer) {
            list.getEntries().forEach(function(entry) {
                const {name, entryType} = entry
                if (entryType === 'navigation') {
                    addTimer('loadEventStart', entry.loadEventStart)
                    addTimer('loadEventEnd', entry.loadEventEnd)
                } else if (entryType === 'paint') {
                    addTimer(name, entry.startTime)
                }
            })
        }).observe({entryTypes: ['paint', 'navigation']})
    }
    function addTimer(name, hr) {
        timers[name] = hr;
        showCurrentData()
    }
    function showCurrentData() {
        var data = Object.keys(timers).map(function(name) {
            return {time: performance.timeOrigin + timers[name], name}
        })
        Object.keys(adTimers[slotId] || {}).forEach(function(eventName) {
            data.push({time: performance.timeOrigin + adTimers[slotId][eventName], name: eventName})
        })
        data = data.sort(function (d1, d2) {
            return d1.time - d2.time
        })
        setData(data)
    }
    function addAdEvent(slotId, eventName) {
        adTimers[slotId] = adTimers[slotId] || {}
        adTimers[slotId][eventName] = performance.now()
    }
    function showAdTimers() {
        slotId = arguments[0]
        showCurrentData()
    }
    function hideAdTimers() {
        slotId = null;
        showCurrentData()
    }
    function initGptListeners() {
        var thickness = 3, color = 'red'

        googletag = window.googletag || {};
        googletag.cmd = googletag.cmd || [];
        googletag.cmd.push(
            function() {
                ;['slotRenderEnded', 'slotOnload'].forEach(function(eventName) {
                    googletag.pubads().addEventListener(eventName, function(e) {
                        console.info('eeeee', JSON.stringify(e))
                        addAdEvent(e.slot.getSlotElementId(), eventName)
                    });
                })

                googletag.defineSlot = (function(_){
                    return function(adUnitPath, size, opt_div) {
                        if (opt_div) {
                            var container = document.getElementById(opt_div);
                            if (container) {
                                container.style.outline = '3px solid ' + color
                                container.style.outlineOffset = '-3px'
                                container.addEventListener('mouseover', function() {
                                    showAdTimers(opt_div)
                                })
                                container.addEventListener('mouseout', function() {
                                    hideAdTimers()
                                })
                            }
                        }
                        return _.apply(this, arguments)
                    }
                })(googletag.defineSlot);
            });
    }

    function initViz(data) {
        var epoch = performance.timeOrigin
        function withDigits(number, digits) {
            if ((number + '').length === digits) return number
            if ((number + '').length + 1 === digits) return `0${number}`
            if ((number + '').length + 2 === digits) return `00${number}`
        }

        var div = document.createElement('div')
        var height = 130
        div.id = 'perf-timeline'
        div.style.cssText = `background-color: white;
opacity: 0.7;
position: fixed;
width: 100%;
bottom: 0px;
left: 0px;
z-index: 10001;
height: ${height}px;
font-size: 16px;
border: solid 1px black;
`
        document.body.appendChild(div)

          chart = new d3KitTimeline('#perf-timeline', {
            direction: 'up',
            initialWidth: window.innerWidth - 20,
            textFn: function (d) {
              return `${d.name} (${Math.ceil(d.time - epoch).toLocaleString()} ms.)`
            },
            formatAxis: function (axis) {
              axis.tickFormat(function (date, index) {
                return `${withDigits(date.getHours(), 2)}:${withDigits(date.getMinutes(), 2)}:${withDigits(date.getSeconds(), 2)}.${withDigits(date.getMilliseconds(), 3)}`
              })
            }
          });

          chart.data(data).visualize().resizeToFit();

          const debounce = (func, delay) => {
            let inDebounce
            return function() {
              const context = this
              const args = arguments
              clearTimeout(inDebounce)
              inDebounce = setTimeout(() => func.apply(context, args), delay)
            }
          }

          // TODO
          0 && window.addEventListener('resize', debounce(function () {
            destroyViz()
            initViz()
          }, 1000))
        }

    function destroyViz() {
        if (chart) {
            chart.destroy()
            chart = null
            var elem = document.getElementById('perf-timeline')
            elem && elem.parentNode.removeChild(elem)
        }
    }

    function setData(data) {
        destroyViz()
        initViz(data)
    }

})();