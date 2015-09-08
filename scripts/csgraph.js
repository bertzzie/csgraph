var width  = 640,
    height = 640,
    radius = Math.min(width, height) / 2;

var x     = d3.scale.linear().range([0, 2 * Math.PI]),
    y     = d3.scale.sqrt().range([0, radius]),
    color = d3.scale.category20c(),
    svg, partition, arc;

svg = d3.select("section#graph").append("svg")
        .attr("width",  width * 2)
        .attr("height", height * 1.5)
        .append("g")
        .attr("transform", "translate(" + width + "," + height / 1.5 + ")");

partition = d3.layout.partition()
              .value(function (d) { return d.size; });

arc = d3.svg.arc()
        .startAngle (function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
        .endAngle   (function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
        .innerRadius(function (d) { return Math.max(0, y(d.y)); })
        .outerRadius(function (d) { return Math.max(0, y(d.y + d.dy)); });

d3.json("data/cs-bodyofknowledge.json", function (error, root) {
	if (error) throw error;

	var path = svg.selectAll("path")
	              .data(partition.nodes(root))
	              .enter().append("path")
	              .attr("d", arc)
	              .attr("id", function (d) { return IDHash(d.name); })
	              .style("fill", function (d) { return color((d.children ? d : d.parent).name); })
	              .on("click", click)
	              .on("mouseover", mouseover)
	              .on("mouseout", mouseout);

    var text = svg.selectAll("text").data(partition.nodes(root));
    var textEnter = text.enter().append("text")
                        .style("fill-opacity", 1)
                        .style("fill", function(d) {
                            return brightness(d3.rgb(colour(d))) < 125 ? "#eee" : "#000";
                    })
                    .attr("text-anchor", function(d) {
                            return x(d.x + d.dx / 2) > Math.PI ? "end" : "start";
                    })
                    .attr("dy", ".2em")
                    .attr("transform", function(d) {
                        var multiline = (d.name || "").split(" ").length > 1,
                            angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90,
                            rotate = angle + (multiline ? -.5 : 0);

                            return "rotate(" + rotate + ")translate(" + (y(d.y) + 10) + ")rotate(" + (angle > 90 ? -180 : 0) + ")";
                    })
                    .on("click", click);

    textEnter.append("tspan")
             .attr("x", 0)
             .attr("class", "child-text")
	         .attr("id", function (d) { return IDHash(d.name) + "-Text"; })
             .text(function (d) {
                 var initial = d.name.split(" ").map(function (name) { return name[0]; }).join("");
                 return d.depth ? initial : d.name;
             })
	              .on("mouseover", mouseover)
	              .on("mouseout", mouseout);

	function click(d) {
		path.transition()
		    .duration(750)
		    .attrTween("d", arcTween(d));

        // Somewhat of a hack as we rely on arcTween updating the scales.
        text.style("visibility", function(e) {
            return isParentOf(d, e) ? null : d3.select(this).style("visibility");
        })
            .transition()
            .duration(1000)
            .attrTween("text-anchor", function(d) {
                return function() {
                    return x(d.x + d.dx / 2) > Math.PI ? "end" : "start";
                };
            })
            .attrTween("transform", function(d) {
                var multiline = (d.name || "").split(" ").length > 1;
    
                return function() {
                    var angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90,
                        rotate = angle + (multiline ? -.5 : 0);

                    return "rotate(" + rotate + ")translate(" + (y(d.y) + 10) + ")rotate(" + (angle > 90 ? -180 : 0) + ")";
                };
            })
            .style("fill-opacity", function(e) { return isParentOf(d, e) ? 1 : 1e-6; })
            .each("end", function(e) {
                d3.select(this).style("visibility", isParentOf(d, e) ? null : "hidden");
            });
	}

	function mouseover(d) {
		d3.select("tspan#" + IDHash(d.name) + "-Text")
		  .transition().delay(100)
		  .text(function (d) { 
		  	return d.name; 
		  });

		if (d.children) {
			d.children.forEach(function (child) {
				d3.select("tspan#" + IDHash(child.name) + "-Text")
				  .style("visibility", "hidden");
			});
		}
	}

	function mouseout(d) {
		d3.select("tspan#" + IDHash(d.name) + "-Text")
		  .transition().delay(100)
		  .text(function (d) {
              var initial = d.name.split(" ").map(function (name) { return name[0]; }).join("");
              return d.depth ? initial : d.name;
		  });

		if (d.children) {
			d.children.forEach(function (child) {
				d3.select("tspan#" + IDHash(child.name) + "-Text")
				  .style("visibility", null);
			});
		}
	}

	function IDHash(name) {
		return name.replace(/[^\w\s]/gi, '').split(" ").join("");
	}

	function isParentOf(p, c) {
        if (p === c) return true;

        if (p.children) {
            return p.children.some(function(d) {
                return isParentOf(d, c);
            });
        }

        return false;
    }


	function colour(d) {
		if (d.children) {
		    // There is a maximum of two children!
		    var colours = d.children.map(colour),
			    a = d3.hsl(colours[0]),
			    b = d3.hsl(colours[1]);

		    // L*a*b* might be better here...
		    return d3.hsl((a.h + b.h) / 2, a.s * 1.2, a.l / 1.2);
		}

		return d.colour || "#fff";
	}

	function maxY(d) {
		return d.children ? Math.max.apply(Math, d.children.map(maxY)) : d.y + d.dy;
	}

	// http://www.w3.org/WAI/ER/WD-AERT/#color-contrast
	function brightness(rgb) {
		return rgb.r * .299 + rgb.g * .587 + rgb.b * .114;
	}
});

d3.select(self.frameElement).style("height", height + "px");

function arcTween(d) {
	var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
	    yd = d3.interpolate(y.domain(), [d.y, 1]),
	    yr = d3.interpolate(y.range(),  [d.y ? 20 : 0, radius]);

	return function (d, i) {
		return i
		    ? function (t) { return arc(d); }
		    : function (t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); }
	}
}
