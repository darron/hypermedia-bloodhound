var blessed = require('blessed');
var contrib = require('blessed-contrib');
var format = require('util').format;

var NUMBER_OF_TOP_SITES = 5;
var NUMBER_OF_TOP_PAGES = 5;

var grid;
var map;
var messages;
var screen;

function getTableOptions(label) {
  return {
    keys: true,
    fg: 'green',
    label: format(label),
    columnSpacing: 1,
    columnWidth: [30, 10]
   };
}

function render() {
  screen = blessed.screen();
  grid = new contrib.grid({rows: 2, cols: 5, screen: screen});

  //ex. grid.set(row, col, rowSpan, colSpan, obj, opts)
  map = grid.set(0, 0, 1, 3, contrib.map, {label: 'World Map'});
  messages = grid.set(0, 3, 1, 2, contrib.log, {fg: "green", selectedFg: "green", label: 'Messages'});
  for (var i = 0; i < NUMBER_OF_TOP_SITES; i++) {
    grid.set(1, i, 1, 1, contrib.table, getTableOptions(format('Top Sites #%s', i + 1)));
  }

  screen.key(['escape', 'q', 'C-c'], function() {
    process.exit();
  });
}

function addMessage(message) {
  return messages && messages.log(message);
}

function setMap(sites) {
  map.clearMarkers();
  for (var i = 0; i < sites.length; i++) {
    var dest = sites[i].dest;
    var src = sites[i].src;
    for(var destIP in dest) {
      map.addMarker({"lon" : dest[destIP].ll[1], "lat" : dest[destIP].ll[0], color: "red", char: "X" });
    }
    for (var srcIP in src) {
      map.addMarker({"lon" : src[srcIP].ll[1], "lat" : src[srcIP].ll[0], color: "red", char: "X" });
    }
  }
}

function setTopSites(sites) {
  for (var i = 0; i < sites.length && i < NUMBER_OF_TOP_SITES; i++) {
    var site = sites[i];
    var table = grid.set(1, i, 1, 1, contrib.table, getTableOptions(site.key));
    var data = { headers: ['page', 'hits'], data: []};

    var pages = site.pages;
    for (var j = 0; j < pages.length && j < NUMBER_OF_TOP_PAGES; j++) {
      data.data.push([pages[j].key, pages[j].value]);
    }
    table.setData(data);
  }

  for (var empty = NUMBER_OF_TOP_SITES - sites.length; empty > 0; empty--) {
    grid.set(1, NUMBER_OF_TOP_SITES - empty, 1, 1, contrib.table, getTableOptions('waiting'));
  }
}

  // // table per website
  // var table = contrib.table({
  //   keys: false,
  //   fg: 'white',
  //   selectedFg: 'white',
  //   selectedBg: 'blue',
  //   interactive: false,
  //   label: 'Website',
  //   width: '20%',
  //   height: '20%',
  //   border: {type: "line", fg: "cyan"},
  //   columnSpacing: 10, //in chars
  //   columnWidth: [16, 12, 12] /*in chars*/
  // });

module.exports = {
  addMessage: addMessage,
  render: render,
  setMap: setMap,
  setTopSites: setTopSites
};
