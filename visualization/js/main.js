define(['d3', 'nvd3', 'elasticsearch'], function (d3, nv, elasticsearch) {
    "use strict";
    var client = new elasticsearch.Client();

    
    client.search({
        index: 'nfl',
        size: 5,
        body: {
            // Begin query.
            query: {
                // Boolean query for matching and excluding items.
                bool: {
                    must: { match: { "description": "TOUCHDOWN" }},
                    must_not: { match: { "qtr": 5 }}
                }
            },
            // Aggregate on the results
            aggs: {
                touchdowns: {
                    terms: {
                        field: "qtr",
                        // order by quarter, ascending
                        order: { "_term" : "asc" }
                    }
                }
            }
            // End query.
        }
    }).then(function (resp) {
        console.log(resp);

        // D3 code goes here.
        var touchdowns = resp.aggregations.touchdowns.buckets;

        // d3 donut chart
        var width = 600,
            height = 300,
            radius = Math.min(width, height) / 2;

        var color = ['#ff7f0e', '#d62728', '#2ca02c', '#1f77b4'];

        var arc = d3.svg.arc()
            .outerRadius(radius - 60)
            .innerRadius(120);

        var pie = d3.layout.pie()
            .sort(null)
            .value(function (d) { return d.doc_count; });

        var svg = d3.select("#donut-chart").append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(" + width/1.4 + "," + height/2 + ")");

        var g = svg.selectAll(".arc")
            .data(pie(touchdowns))
            .enter()
            .append("g")
            .attr("class", "arc");

        g.append("path")
            .attr("d", arc)
            .style("fill", function (d, i) { return color[i]; });

        g.append("text")
            .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
            .attr("dy", ".35em")
            .style("text-anchor", "middle")
            .style("fill", "white")
            .text(function (d) { return d.data.key; });
    });

    client.search({
        index: 'nfl',
        size: 5,
        body: {
            query: {
                bool: {
                    must: { match: { "description": "TOUCHDOWN"}},
                    must_not: [
                        { match: { "description": "intercepted"}},
                        { match: { "description": "incomplete"}},
                        { match: { "description": "FUMBLES"}},
                        { match: { "description": "NULLIFIED"}}
                    ]
                }
            },
            aggs: {
                teams: {
                    terms: {
                        field: "off",
                        exclude: "", // exclude empty strings.
                        size: 5 // limit to top 5 teams (out of 32).
                    },
                    aggs: {
                        players: {
                            terms: {
                                field: "description",
                                include: "([a-z]?[.][a-z]+)", // regex to pull out player names.
                                size: 20 // limit to top 20 players per team. 
                            },
                            aggs: {
                                qtrs: {
                                    terms: {
                                        field: "qtr"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }).then(function (resp) {
        console.log(resp);

        // D3 code goes here.
        var root = createChildNodes(resp);

        // d3 dendrogram
        var width = 600,
            height = 2000;

        var color = ['#ff7f0e', '#d62728', '#2ca02c', '#1f77b4'];

        var cluster = d3.layout.cluster()
            .size([height, width - 200]);

        var diagonal = d3.svg.diagonal()
            .projection(function(d) { return [d.y, d.x]; });

        var svg = d3.select("#dendrogram").append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(120,0)");

        var nodes = cluster.nodes(root),
            links = cluster.links(nodes);

        var link = svg.selectAll(".link")
            .data(links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", diagonal);

        var node = svg.selectAll(".node")
            .data(nodes)
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

        node.append("circle")
            .attr("r", 4.5)
            .style("fill", function (d) {
                return d.children ? "#ffffff" : color[d.key - 1];
            })
            .style("stroke", function (d) {
                return d.children ? "#4682B4" : color[d.key - 1];
            });

        node.append("text")
            .attr("dx", function(d) { return d.children ? -8 : 8; })
            .attr("dy", 3)
            .style("text-anchor", function(d) { return d.children ? "end" : "start"; })
            .text(function(d) { return d.children? d.key : d.key + ": " + d.doc_count; });

        d3.select(self.frameElement).style("height", height + "px");

        function createChildNodes(dataObj) {
            var root = {};

            root.key = "NFL";
            root.children = dataObj.aggregations.teams.buckets;
            root.children.forEach(function (d) { d.children = d.players.buckets; });
            root.children.forEach(function (d) { 
                d.children.forEach(function (d) { 
                    d.children = d.qtrs.buckets; 
                });
            });

            return root;
        }
    });

    
    
    /*
    nv.addGraph(function() {
      var chart = nv.models.lineWithFocusChart();

      chart.xAxis
        .tickFormat(d3.format(',f'));

      chart.yAxis
        .tickFormat(d3.format(',.2f'));

      chart.y2Axis
        .tickFormat(d3.format(',.2f'));

      d3.select('#chart svg')
        .datum(testData())
        .transition().duration(500)
        .call(chart)
        ;

      nv.utils.windowResize(chart.update);

      return chart;
    });
    
    */

    function testData() {
      return stream_layers(3,128,.1).map(function(data, i) {
        return { 
          key: 'Stream' + i,
          values: data
        };
      });
    }

    /* Inspired by Lee Byron's test data generator. */
    function stream_layers(n, m, o) {
      if (arguments.length < 3) o = 0;
      function bump(a) {
        var x = 1 / (.1 + Math.random()),
            y = 2 * Math.random() - .5,
            z = 10 / (.1 + Math.random());
        for (var i = 0; i < m; i++) {
          var w = (i / m - y) * z;
          a[i] += x * Math.exp(-w * w);
        }
      }
      return d3.range(n).map(function() {
          var a = [], i;
          for (i = 0; i < m; i++) a[i] = o + o * Math.random();
          for (i = 0; i < 5; i++) bump(a);
          return a.map(stream_index);
        });
    }

    /* Another layer generator using gamma distributions. */
    function stream_waves(n, m) {
      return d3.range(n).map(function(i) {
        return d3.range(m).map(function(j) {
            var x = 20 * j / m - i / 3;
            return 2 * x * Math.exp(-.5 * x);
          }).map(stream_index);
        });
    }

    function stream_index(d, i) {
      return {x: i, y: Math.max(0, d)};
    }


    client.search({
        index: 'logstash-2014.04.22',
        type: 'cpu',
        size: 20,
        body: {
            query: {
              match: {
                type: 'cpu'
              }
            }
        }
    }).then(function (resp) {
        console.log(resp);

        var hits = resp.hits.hits;

        var data = {};

        data.key = hits[0]._source.ip;
        data.values = [];

        hits.forEach(function(hit){
            data.values.push([hit._source['@timestamp'], hit._source['us']]);
        });

        nv.addGraph(function() {
          var chart = nv.models.stackedAreaChart()
                        .x(function(d) { return d[0] })
                        .y(function(d) { return d[1] });

          chart.xAxis.axisLabel('Time')
              .tickFormat(function(d) { return d3.time.format('%x')(new Date(d)) });

          chart.yAxis.axisLabel('CPU Usage')
              .showMaxMin(false)
              .tickFormat(d3.format(',.2f'));

          d3.select('#chart svg')
            .datum([data])
              .transition().duration(500).call(chart);

          nv.utils.windowResize(chart.update);

          return chart;
        });


    });

});