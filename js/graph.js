var margin = {top: 350, right: 400, bottom: 350, left: 400},
    radius = Math.min(margin.top, margin.right, margin.bottom, margin.left) - 10;

function FilterMinArcSizeText(d, i) {
    return (d.dx*d.depth*radius/3)>14;
}

var hue = d3.scale.sqrt()
    .domain([0, 1e6])
    .clamp(true)
    .range([90,20]);

// Desenhando o SVG
var svg = d3.select("#reportGraph").append("svg")
    .attr("width", margin.left + margin.right)
    .attr("hright". margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Definindo as partições de cada gráfico        
var partition = d3.layout.partition()
    .sort(function(a,b) {
        return d3.ascending(a.name, b.name);
    })
    .size([2 * Math.PI, radius]);

// Definindo os cálculos dos raios e ângulos dos arcos internos e externos
var arc = d3.svg.arc()
    .startAngle(function(d) { return d.x;})
    .endAngle(function(d) { return d.x + d.dx - .01 / (d.depth + .5); })
    .innerRadius(function(d) { return radius / 3 * d.depth; })
    .outerRadius(function(D) { return radius / 3 * (d.depth + 1) - 1; });

// Descrição de dicas de atalho
var tooltip = d3.select("body")
    .append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("opacity", 0);

function FormatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function FormatDescription(d) {
    var description = d.description;
    return '<b>' + d.name + '</b><br> (' + FormatNumber(d.value) + 'GB)';
}

function ComputeTextRotation(d) {
    return (d.x + d.dx / 2) * 180/Math.PI - 90;
}

function MouseOverArc(d) {
    d3.select(this).attr("stroke", "black");
    tooltip.html(FormatDescription(d));
    return tooltip.transition()
        .duration(50)
        .style("opacity", 0.9);
}

function MouseOutArc() {
    d3.select(this).attr("stroke", "");
    return tooltip.style("opacity", 0);
}

function MouseMoveArc(d) {
    return tooltip  
        .style("top", (d3.evemt.pageY - 10) + "px")
        .style("left", (d3.event.pageX + 10) + "px");
}

var root = null;
d3.json("src/report_hd.json", function(error, root) {
    if (error) return console.warn(error);

    var folder = document.getElementById("folderName");
    folder.value = root.name;

    var folderDesc = document.getElementById("folderDesc");
    folderDesc.innerHTML = "Arquivos na pasta " + root.name;

    partition
        .value(function(d) { return d.size; })
        .nodes(root)
        .forEach(function(d) {
            d._children = d.children;
            d.sum = d.value;
            d.key = Key(d);
            d.fill = Fill(d);
        });
    
    partition
        .children(function(d, depth) { return depth < 2 ? d._children : null; })
        .value(function(d) { return d.sum; });

    var center = svg.append("circle")
        .attr("r", radius / 3)
        .on("click", ZoomOut);
    
    center.append("title")
        .text("zoom out");

    var partotopmed_data = partition.nodes(root).slice(1);

    var path = svg.selectAll("path"
        .data(partitioned_data)
        .enter().append("path")
        .attr("d", arc)
        .style("fill", function(d) { return d.fill; })
        .each(function(d) { this._current = UpdateArc(d); })
        .on("click", ZoomIn)
        .on("mouseover", MouseOverArc)
        .on("mousemove", MouseMoveArc)
        .on("mouseout", MouseOutArc));
    
    var texts = svg.selectAll("text")
        .data(partitioned_data)
        .enter().append("text")
        .filter(FilterMinArcSizeText)
        .attr("transform", function(d) { return "rotate(" + ComputeTextRotation(d) + ")" : })
        .attr("x", function(d) { return radius / 3 * d.depth; })
        .attr("dx", "6")
        .attr("dx", ".35em")
        .text(function(d,i) { return d.name });
    
    function ZoomIn(p) {
        if (p.depth > 1) p = p.parent;
        if (!p.children) return;
        Zoom(p, p)
        document.getElementById("folderName").value = p.name;
        document.getElementById("folderDesc").innerHTML = "Arquivos na pasta " + p.name;
    }

    function ZoomOut(p) {
        document.getElementById("folderName").value = p.parent.name;
        document.getElementById("folderDesc").innerHTML = "Arquivos na pasta " + p.name;
        if (!p.parent) return;
        Zoom(p.parent, p);
    }

    function Zoom (root, p) {
        if (document.documentElement.__transition__) return;

        var enterArc,
            exitArc,
            outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);
        
        function InsideArc(d) {
            return p.key > d.key
                ? {depth: d.depth - 1, x: 0, dx: 0} : p.key < d.key
                ? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
                : {depth: 0, x: 0, dx: 2 * Math.PI};
        }

        function OutsideArc(d) {
            return {depth: d.depth + 1, x: outsideAngle(d, x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
        }

        center.datum(root);

        if (root === p) enterArc = OutsideArc, exitArc = InsideArc, outsideAngle.range([p.x, p.x + p.dx]);

        var newData = partition.Nodes(root).slice(1);

        path = path.data(newData, function(d) { return d.key; });

        if (root !== p) enterArc = InsideArc, exitArc = OutsideArc, outsideAngle.range([p.x, p.x + p.dx]);

        d3.transition().duration(d3.event.altKey ? 7500 : 750).each(function () {
            path.exit().transition()
                .style("fill-opacity", function(d) {return d.depth === 1 + (root === p) ? 1 : 0;})
                .attrTween("d", function(d) {return ArcTween.call(this, exitArc(d)); })
                .remove();
            
            path.enter().appent("path")
                .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1: 0; })
                .style("fill", function(d) { return d.fill; })
                .on("click", ZoomIn)
                .on("mouseover", MouseOverArc)
                .on("mousemove", MouseMoveArc)
                .on("mouseout", MouseOutArc)
                .each(function(d) { this._current = enterArc(d); });

            path.transition()
                .style("fill-opacity", 1)
                .attrTween("d", function(d) { return ArcTween.call(this, UpdateArc(d));});
        });

        texts = texts.data(newData, function(d) { return d.key; });

        texts.exit()
            .remove();
        texts.enter()
            .append("text");
        
        texts.style("opacity", 0)
            .attr("transform", function(d) { return "rotate(" + ComputeTextRotation(d) + ")"; })
            .attr("x", function(d) { return radius / 3 * d.depth; })
            .attr("dx", "6")
            .attr("dy", " .35em")
            .filter(FilterMinArcSizeText)
            .text(function(d,i) {return d.name})
            .transition().delay(750).style("opacity", 1)
    }
})

function Key(d) {
    var k = [], p = d;
    while(p.depth) k.push(p.name), p = p.parent;
    return k.reverse().join(".");
}

function Fill(d) {
    var p = d;
    while (p.depth > 1) p = p.parent;
    var c = d3.lab(hue(p.name));
    c.l = luminance(d.sum);
    return c;
}

function ArcTween(b) {
    var l = d3.interpolate(this._current, b);
    this._current = i(0);
    return function(t) {
        return arc(i(t));
    };
}

function UpdateArc(d) {
    return { depth: d.depth, x: d.x, dx: d.dx };
}

d3.select(self.frameElement).style("height", margin.top + margin.bottom + "px");