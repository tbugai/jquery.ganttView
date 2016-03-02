/*
jQuery.ganttView v.0.8.8
Copyright (c) 2010 JC Grubbs - jc.grubbs@devmynd.com
MIT License Applies
*/

/*
Options
-----------------
showWeekends: boolean
showToday: boolean
data: object
style: string
cellWidth: number
cellHeight: number
slideWidth: number
dataUrl: string
eventTextFormatter: function
behavior: {
	clickable: boolean,
	draggable: boolean,
	resizable: boolean,
	onClick: function,
	onDrag: function,
	onResize: function
}
*/

(function(jQuery) {

  jQuery.fn.ganttView = function() {

    var args = Array.prototype.slice.call(arguments);

    if (args.length == 1 && typeof (args[0]) == "object") {
      build.call(this, args[0]);
    }

    if (args.length == 2 && typeof (args[0]) == "string") {
      handleMethod.call(this, args[0], args[1]);
    }
  };

  function build(options) {
    var els = this;
    var defaults = {
      showWeekends: true,
      style: "Days",  // "Weeks", "Months"
      showToday: true,
      cellWidth: 21,
      cellHeight: 31,
      slideWidth: 400,
      vHeaderWidth: 100,
      eventTextFormatter: defaultEventTextFormatter,
      header: {
        groupsRenderer: monthsHeaderRenderer,
        columnsRenderer: daysHeaderRenderer
      },
      behavior: {
        clickable: true,
        draggable: true,
        resizable: true
      }
    };

    var opts = jQuery.extend(true, defaults, options);

    if (opts.data) {
      build();
    } else if (opts.dataUrl) {
      jQuery.getJSON(opts.dataUrl, function(data) {
        opts.data = data;
				build();
      });
    }

    function build() {
      if (opts.style == "Days") {
        opts.cellWidth = 21;
        opts.header.columnsRenderer = daysHeaderRenderer;
      } else if (opts.style == "Weeks") {
        opts.cellWidth = 15;
        opts.header.columnsRenderer = weeksHeaderRenderer;
      }


      var minDays = Math.floor((opts.slideWidth / opts.cellWidth) + 5);
      var startEnd = DateUtils.getBoundaryDatesFromData(opts.data, minDays);
      opts.start = startEnd[0];
      opts.end = startEnd[1];

      console.log("range: " + opts.start + " through " + opts.end);

      els.each(function() {
        var container = jQuery(this);
        var div = jQuery("<div>", { "class": "ganttview" });
        new Chart(div, opts).render();
        container.append(div);

        // var w = jQuery("div.ganttview-vtheader", container).outerWidth() +
        // 	jQuery("div.ganttview-slide-container", container).outerWidth();
        container.css("width", "100%");

        new Behavior(container, opts).apply();
      });
    }
  }

  function handleMethod(method, value) {
    if (method == "setSlideWidth") {
      var div = $("div.ganttview", this);
      div.each(function() {
        var vtWidth = $("div.ganttview-vtheader", div).outerWidth();
        $(div).width(vtWidth + value + 1);
        $("div.ganttview-slide-container", this).width(value);
      });
    }
  }

  function defaultEventTextFormatter(activity, series, group) {
    return DateUtils.daysBetween(activity.start, activity.end) + 1;
  }

  function monthsHeaderRenderer(container, opts) {
    var accumulator = 0;
    var currentDate = opts.start.clone()
    var currentMonth = currentDate.getMonth();
    while (opts.end.compareTo(currentDate) != -1) {
      if (currentDate.getMonth() != currentMonth) {
        container.append(jQuery("<div>", {
          "class": "ganttview-hzheader-group",
          "css": {
            "width": ((accumulator * (opts.cellWidth + 1)) - 1) + "px"
          }
        }).append(currentDate.clone().last().month().toString("MMM")));
        accumulator = 0;
        currentMonth = currentDate.getMonth();
      }
      accumulator += 1;
      currentDate.addDays(1);
    }

    container.append(jQuery("<div>", {
      "class": "ganttview-hzheader-group",
      "css": {
        "width": ((accumulator * (opts.cellWidth + 1)) - 1) + "px"
      }
    }).append(currentDate.toString("MMM")));
  }

  function weeksHeaderRenderer(container, opts) {
    var accumulator = 0;
    var currentDate = opts.start.clone();
    while (opts.end.compareTo(currentDate) != -1) {
      accumulator += 1;
      if (currentDate.getDay() == 6) {
        container.append(jQuery("<div>", {
          "class": "ganttview-hzheader-column",
          "css": {
            "width": (((opts.cellWidth + 1) * accumulator) - 1) + "px"
          }
        }).append(currentDate.clone().addDays(-6).getDate() + " - " + currentDate.getDate()));
        accumulator = 0;
      }
      currentDate.addDays(1);
    }
    container.append(jQuery("<div>", {
      "class": "ganttview-hzheader-column",
      "css": {
        "width": (((opts.cellWidth + 1) * accumulator) - 1) + "px"
      }
    }).append(currentDate.clone().addDays(-6).getDate() + " - " + currentDate.getDate()));
  }

  function daysHeaderRenderer(container, opts) {
    var currentDate = opts.start.clone();
    while (opts.end.compareTo(currentDate) != -1) {
      container.append(jQuery("<div>", {
        "class": "ganttview-hzheader-column",
        "css": {
          "width": opts.cellWidth + "px"
        }
      }).append(currentDate.getDate()));
      currentDate.addDays(1);
    }
  }

  var Chart = function(div, opts) {
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function render() {
			prepareData(opts.data);
			addVtHeader(div, opts);

      var slideDiv = jQuery("<div>", {
        "class": "ganttview-slide-container",
        "css": {
          "width": opts.slideWidth + "px"
        }
      });

      dates = getDates(opts.start, opts.end);

      addHzHeader(slideDiv, dates, opts);
      addGrid(slideDiv, dates, opts);
      addBlockContainers(slideDiv, opts);
      addBlocks(slideDiv, opts);

      div.append(slideDiv);
      applyLastClass(div.parent());
    }

    // Creates a 3 dimensional array [year][month][day] of every day
    // between the given start and end dates
    function getDates(start, end) {
      var dates = [];
      dates[start.getFullYear()] = [];
      dates[start.getFullYear()][start.getMonth()] = [start]
      var last = start;
      while (last.compareTo(end) == -1) {
        var next = last.clone().addDays(1);
        if (!dates[next.getFullYear()]) {
          dates[next.getFullYear()] = [];
        }
        if (!dates[next.getFullYear()][next.getMonth()]) {
          dates[next.getFullYear()][next.getMonth()] = [];
        }
        dates[next.getFullYear()][next.getMonth()].push(next);
        last = next;
      }
      return dates;
    }

		function isOverlapped(activity1, activity2) {
			if (activity1 == null || activity2 == null) {
				return false;
			}

			if ((activity2.start < activity1.start && activity2.end > activity1.start) ||
					(activity2.start < activity1.end && activity2.end > activity1.end) ||
					(activity2.start > activity1.start && activity2.end < activity1.end)) {
				return true;
			}
			return false;
		}

    function preprocessDate(activity) {
      if (typeof(activity.start) != Date) {
        activity.start = Date.parse(activity.start);
      }
      if (typeof(activity.end) != Date) {
        activity.end = Date.parse(activity.end);
      }
    }

		function prepareData(data) {
			for (var currentGroup of data) {
				for (var seriesIndex = 0; seriesIndex < currentGroup.series.length; seriesIndex++) {
					var currentSeries = currentGroup.series[seriesIndex];
					var conflicts = [];

					for (var i = 0; i < currentSeries.activities.length; i++) {
            preprocessDate(currentSeries.activities[i]);

						for(var j = i + 1; j < currentSeries.activities.length; j++) {
              preprocessDate(currentSeries.activities[j]);

							if (isOverlapped(currentSeries.activities[i], currentSeries.activities[j])) {
								conflicts.push(currentSeries.activities[j]);
								currentSeries.activities.splice(j, 1);
								j--;
								if (i != 0) i--;
							}
						}
					}

					if (conflicts.length > 0) {
						currentGroup.series.splice(seriesIndex + 1, 0, { activities: conflicts });
					}
				}
			}
		}

    function addVtHeader(div, opts) {
      var headerDiv = jQuery("<div>", {
        "class": "ganttview-vtheader"
      });

			for (var currentGroup of opts.data) {
        var itemDiv = jQuery("<div>", { "class": "ganttview-vtheader-item" });

        if ($.trim(currentGroup.name).length > 0)
          var seriesDiv = jQuery("<div>", {
            "class": "ganttview-vtheader-series"
          });

        itemDiv.append(jQuery("<div>", {
          "class": "ganttview-vtheader-item-name",
          "css": {
            "height": (currentGroup.series.length * opts.cellHeight) + "px"
          }
        }).append(currentGroup.name));

				for (var currentSeries of currentGroup.series) {
					var classNames = "ganttview-vtheader-series-name"
					if (currentSeries.name === undefined || currentSeries.name == "") {
						classNames += " no-name";
					}
          seriesDiv.append(jQuery("<div>", { "class": classNames})
						.append(currentSeries.name));
        }

        itemDiv.append(seriesDiv);
        headerDiv.append(itemDiv);
      }
      div.append(headerDiv);
    }

    function addHzHeader(div, dates, opts) {
      var headerWidth = ((DateUtils.daysBetween(opts.start, opts.end) + 1) * (opts.cellWidth + 1));

      var headerDiv = jQuery("<div>", {
        "class": "ganttview-hzheader"
      });

      var monthsDiv = jQuery("<div>", {
        "class": "ganttview-hzheader-groups",
        "css" : {
          "width": headerWidth + "px"
        }
      });
      var daysDiv = jQuery("<div>", {
        "class": "ganttview-hzheader-columns",
        "css" : {
          "width": headerWidth + "px"
        }
      });
      headerDiv.append(monthsDiv).append(daysDiv);
      div.append(headerDiv);

      // groups renderer
      opts.header.groupsRenderer(monthsDiv, opts);
      // monthsHeaderRenderer(monthsDiv, opts);

      // columns renderer (weeks)
      // weekColumnHeaders(daysDiv, opts);
      // daysHeaderRenderer(daysDiv, opts);
      opts.header.columnsRenderer(daysDiv, opts);
    }

    function addGrid(div, dates, opts) {
      var gridDiv = jQuery("<div>", {
        "class": "ganttview-grid"
      });
      var rowDiv = jQuery("<div>", {
        "class": "ganttview-grid-row"
      });

      var currentDate = opts.start.clone();
      while (opts.end.compareTo(currentDate) != -1) {
        var cellDiv = jQuery("<div>", {
          "class": "ganttview-grid-row-cell",
          "css" : {
            "width" : opts.cellWidth + "px"
          }
        });
        if (DateUtils.isWeekend(currentDate) && opts.showWeekends) {
          cellDiv.addClass("ganttview-weekend");
        }
        if (DateUtils.isToday(currentDate) && opts.showToday) {
          cellDiv.addClass("ganttview-today");
        }
        rowDiv.append(cellDiv);

        currentDate.addDays(1);
      }
      var w = jQuery("div.ganttview-grid-row-cell", rowDiv).length * (opts.cellWidth + 1);
      rowDiv.css("width", w + "px");
      gridDiv.css("width", w + "px");
      for (var i = 0; i < opts.data.length; i++) {
        for (var j = 0; j < opts.data[i].series.length; j++) {
          gridDiv.append(rowDiv.clone());
        }
      }
      div.append(gridDiv);
    }

    function addBlockContainers(div, opts) {
      var blocksDiv = jQuery("<div>", {
        "class": "ganttview-blocks"
      });
      for (var i = 0; i < opts.data.length; i++) {
        for (var j = 0; j < opts.data[i].series.length; j++) {
          blocksDiv.append(jQuery("<div>", {
            "class": "ganttview-block-container"
          }));
        }
      }
      div.append(blocksDiv);
    }

    function addBlocks(div, opts) {
      var rows = jQuery("div.ganttview-blocks div.ganttview-block-container", div);
      var rowIdx = 0;
			for (var currentGroup of opts.data) {
				for (var currentSeries of currentGroup.series) {
					for (var currentActivity of currentSeries.activities) {
						jQuery(rows[rowIdx]).append(generateBlock(currentGroup, currentActivity, opts)); //opts.start, opts.cellWidth));
					}
          rowIdx = rowIdx + 1;
        }
      }
    }

		function generateBlock(data, activity, opts) {
			var size = DateUtils.daysBetween(activity.start, activity.end) + 1;
			var offset = DateUtils.daysBetween(opts.start, activity.start);
			var block = jQuery("<div>", {
				"class": "ganttview-block",
				"title": activity.name + ", " + size + " days",
				"css": {
					"width": ((size * (opts.cellWidth + 1)) - 5) + "px",
					"margin-left": ((offset * (opts.cellWidth + 1))+1) + "px"
				}
			});
			addBlockData(block, data, activity);
			if (activity.color) {
				block.css("background-color", activity.color);
			}
			block.append(jQuery("<div>", {
				"class": "ganttview-block-text"
			}).html(opts.eventTextFormatter(activity)));

			return block;
		}

    function addBlockData(block, data, series) {
      // This allows custom attributes to be added to the series data objects
      // and makes them available to the 'data' argument of click, resize, and drag handlers
      var blockData = {
        id: data.id,
        name: data.name
      };
      jQuery.extend(blockData, series);
      block.data("block-data", blockData);
    }

    function applyLastClass(div) {
      jQuery("div.ganttview-grid-row div.ganttview-grid-row-cell:last-child", div).addClass("last");
      jQuery("div.ganttview-hzheader-days div.ganttview-hzheader-day:last-child", div).addClass("last");
      jQuery("div.ganttview-hzheader-months div.ganttview-hzheader-month:last-child", div).addClass("last");
    }

    return {
      render: render
    }
  }


  var Behavior = function(div, opts) {

    function apply() {

      if (opts.behavior.clickable) {
        bindBlockClick(div, opts.behavior.onClick);
      }

      if (opts.behavior.resizable) {
        bindBlockResize(div, opts.cellWidth, opts.start, opts.behavior.onResize);
      }

      if (opts.behavior.draggable) {
        bindBlockDrag(div, opts.cellWidth, opts.start, opts.behavior.onDrag);
      }
    }

    function bindBlockClick(div, callback) {
      jQuery("div.ganttview-block", div).on("click", function() {
        if (callback) {
          callback(jQuery(this).data("block-data"));
        }
      });
    }

    function bindBlockResize(div, cellWidth, startDate, callback) {
      jQuery("div.ganttview-block", div).resizable({
        grid: cellWidth,
        handles: "e,w",
        stop: function() {
          var block = jQuery(this);
          updateDataAndPosition(div, block, cellWidth, startDate);
          if (callback) {
            callback(block.data("block-data"));
          }
        }
      });
    }

    function bindBlockDrag(div, cellWidth, startDate, callback) {
      jQuery("div.ganttview-block", div).draggable({
        axis: "x",
        grid: [cellWidth, cellWidth],
        stop: function() {
          var block = jQuery(this);
          updateDataAndPosition(div, block, cellWidth, startDate);
          if (callback) {
            callback(block.data("block-data"));
          }
        }
      });
    }

    function updateDataAndPosition(div, block, cellWidth, startDate) {
      var container = jQuery("div.ganttview-slide-container", div);
      var scroll = container.scrollLeft();
      var offset = block.offset().left - container.offset().left - 1 + scroll;

      // Set new start date
      var daysFromStart = Math.round(offset / cellWidth);
      var newStart = startDate.clone().addDays(daysFromStart);
      block.data("block-data").start = newStart;

      // Set new end date
      var width = block.outerWidth();
      var numberOfDays = Math.round(width / cellWidth) - 1;
      block.data("block-data").end = newStart.clone().addDays(numberOfDays);
      jQuery("div.ganttview-block-text", block).text(numberOfDays + 1);

      // Remove top and left properties to avoid incorrect block positioning,
      // set position to relative to keep blocks relative to scrollbar when scrolling
      block.css("top", "").css("left", "")
        .css("position", "relative").css("margin-left", offset + "px");
    }

    return {
      apply: apply
    };
  }

  var ArrayUtils = {
    contains: function(arr, obj) {
      var has = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] == obj) {
          has = true;
        }
      }
      return has;
    }
  };

	function forEach(data, callback) {
		for (var groupIndex = 0; groupIndex < data.length; groupIndex++) {
			var currentGroup = data[groupIndex];
			for (var seriesIndex = 0; seriesIndex < currentGroup.series.length; seriesIndex++) {
				var currentSeries = currentGroup.series[seriesIndex];
				for (var activityIndex = 0; activityIndex < currentSeries.activities.length; activityIndex++) {
					var currentActivity = currentSeries.activities[activityIndex];

					callback(currentGroup, currentSeries, currentActivity, groupIndex, seriesIndex, activityIndex);
				}
			}
		}
	}

  var DateUtils = {
    daysBetween: function(start, end) {
      if (!start || !end) {
        return 0;
      }

      if (start.getYear() == 1901 || end.getYear() == 8099) {
        return 0;
      }
      var count = 0,
        date = start.clone();
      while (date.compareTo(end) == -1) {
        count = count + 1; date.addDays(1);
      }
      return count;
    },

    isWeekend: function(date) {
      return date.getDay() % 6 == 0;
    },

    isToday: function(date) {
      return date.isToday();
    },

    getBoundaryDatesFromData: function(data, minDays) {
      var minStart = new Date();
      var maxEnd = new Date();

			forEach(data, function( _, _, activity, groupIndex, seriesIndex, activityIndex) {
				var start = Date.parse(activity.start);
        var end = Date.parse(activity.end)
        if (groupIndex == 0 && seriesIndex == 0 && activityIndex == 0) {
          minStart = start;
          maxEnd = end;
        }
        if (minStart.compareTo(start) == 1) {
          minStart = start;
        }
        if (maxEnd.compareTo(end) == -1) {
          maxEnd = end;
        }
			});

      // Insure that the width of the chart is at least the slide width to avoid empty
      // whitespace to the right of the grid
      if (DateUtils.daysBetween(minStart, maxEnd) < minDays) {
        maxEnd = minStart.clone().addDays(minDays);
      }

      return [minStart, maxEnd];
    }
  };

})(jQuery);
