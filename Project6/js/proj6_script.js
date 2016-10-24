/***********************************************************************\
*************************************************************************
                        GENERAL HELPER FUNCTIONS
*************************************************************************
\***********************************************************************/
function create_svg(div_name, svg_cfg)
{
    var ret_svg = d3.select("#" + div_name).append("svg")
                    .attr("width", svg_cfg.width)
                    .attr("height", svg_cfg.height)
                    .attr("fill", svg_cfg.fill);

    return ret_svg;
}

function create_tooltip(div_name, t_class)
{
    return d3.select('#' + div_name)
             .append('div')
             .attr('class', t_class);
}

function html_compatible_id(id)
{
    //Country names are originally created with spaces, commas..etc. These pose troubles
    //when dealing with them programmatically. This function cleans the name to be just a
    //string with no spaces, so that they are easy to refer to programmatically
    var html_compatible_name = id;
    html_compatible_name = html_compatible_name.split(" ").join("");
    html_compatible_name = html_compatible_name.split(".").join("");
    html_compatible_name = html_compatible_name.replace("'", "");
    html_compatible_name = html_compatible_name.replace(",", "_");
    return html_compatible_name;
}



world_2011_data = {}; //Will hold the whole world data

//Build the data from the input. The data needs to be stored in a special structure, so this is
//what this function does.
function build_world_data(data_entry)
{
    data_group_by_metric = d3.nest()
                             .key(function(d)
                                 {
                                     return d.country;
                                 })
                             .key(function(d)
                                 {
                                     return d.metric;
                                 })
                             .entries(data_entry)

    temp_arr = []; //Function's return variable, will hold country data
    temp_element = {}; //Used to fill the temp_arr

    //Loop over each country
    for(var k1 of data_group_by_metric.keys())
    {
        temp_element["name"] = html_compatible_id(data_group_by_metric[k1].key);

        //Loop over each metric
        for (var k2 of data_group_by_metric[k1].values.keys() )
        {
            param = data_group_by_metric[k1].values[k2].key;
            temp_element[param] = +data_group_by_metric[k1].values[k2].values[0].value;
        }

        temp_arr.push(temp_element);

        //Reset temp element for next loop. Not sure why, but it doesn't work otherwise
        //I was expecting that it would just overwrite the older value and no need
        //to clear the temp_element.
        temp_element = {};

    }
    return temp_arr;
}

//Given a country name and the data, it wil search of its entry and return its whole data.
//It is used to extract a country's data for the rest of the program.
function get_country_data(world_data, country_name)
{
    //http://stackoverflow.com/questions/7176908/how-to-get-index-of-object-by-its-property-in-javascript
    country_index = -1;//world_data.map(function(e) { return e.name; }).indexOf(country_name);
    for(i in world_data)
    {
        if(world_data[i].name == country_name)
        {
            country_index = i;
            break;
        }
    }

    return world_data[country_index];
}

/***********************************************************************\
*************************************************************************
                        COLORED WORLD MAP
*************************************************************************
\***********************************************************************/
//The map's SVG configuration. I got this idea from visualcinnamon.com blog. It makes the code
//much cleaner
var map_svg_cfg = {
                        total_width : 700,
                        total_height : 750,
                        margin : {top: 0, right: 0, bottom: 0, left: 0},
                        width : 700,
                        height : 450,
                        fill: "lightBlue"
                  }

var projection = d3.geo.mercator()
                       .scale(110)
                       .translate([map_svg_cfg.width / 2, map_svg_cfg.height / 1.5]);;

var map_svg = create_svg("world_map_div", map_svg_cfg);

var previous_hovered_country = "World"; //Used to prevent the country profile update when the mouse is moving over the same country
var hovered_over_country = "World";
/*
FROM DOCUMENTATION:
The primary mechanism for displaying geographic data is d3.geo.path. This class is similar to
d3.svg.line and the other SVG shape generators: given a geometry or feature object, it generates
the path data string suitable for the "d" attribute of an SVG path element. The d3.geo.path class
can render directly to Canvas, which may offer better performance when animating the projection.
*/
var map_path = d3.geo.path()
  .projection(projection);

/*
Background rectangle, the ocean
*/
map_svg.append("rect")
        .attr("class", "background")
        .attr("width", map_svg_cfg.width)
        .attr("height", map_svg_cfg.height)

var map_g = map_svg.append("g");

//This variable will hold the last hovered over country. It is global to make things simpler,
//since all svgs update their values according to the value held by this variable
var selectedCountry = {}

//The tooltip displaying the country name when the mouse is over it on the map
var tooltip = create_tooltip('world_map_div', 'hidden tooltip');

//This scale os for the map colouring. It maps CO2 emissions in kilo tonnes to a range of colors
//The reason that it is linear and not simple log is that the countries tend to be scattered yet
//concentrated around certain range. simple log or linear between just two colors made it harder
//for the eyes to notice differences. It is created global because it is used in different functions,
//not the cleanest design but makes things much simpler adn faster to implement.
var emissions_scale = d3.scale.linear()
                              .domain([1000,      100000,  300000,         500000,    1000000,  2000000,  3000000, 6000000, 12000000])
                             .range(["darkgreen", "green", "yellowgreen",  "yellow", "orange", "darkorange", "orangered", "red", "darkred"]);

d3.json("js/maps/modified_map.json",
        function(error, x)
        {
             map_g.append("g")
                    .attr("id", "countries")
                    //Select all is just a replacement for looping over all selected elements
                    .selectAll("path")
                    //Data to be used for g
                    .data(topojson.feature(x, x.objects.countries).features)
                    /*Add it to the container. Updating nodes are the default selection—the result of the
                    data operator. Thus, if you forget about the enter and exit selections, you will
                    automatically select only the elements for which there exists corresponding data.*/
                    .enter()
                    .append("path")
                    .attr("d", map_path)
                    .attr("id", function(d)
                                {
                                    //Country's ID
                                    return html_compatible_id(d.properties.name);

                                })
                    .on('mousemove',
                                function(d)
                                {
                                    //get mouse location
                                    var mouse = d3.mouse(map_svg.node()).map(function(d)
                                    {
                                        return parseInt(d);
                                    });
                                    //Get the path object the mouse is currently over it
                                    selectedCountry = this;

                                    //highlight the country by decreasing its opacity
                                    d3.select(selectedCountry).style('fill-opacity', 0.6);

                                    tooltip.classed('hidden', false)
                                        .attr('style', 'left:' + (mouse[0] + 15) +
                                                'px; top:' + (mouse[1] - 35) + 'px')
                                        .html(selectedCountry.id);

                                        //update the hovered over country variable so that other
                                        //parts of the page can update their visualizations
                                        hovered_over_country = selectedCountry.id;

                                        //If the mosue has moved over a new country, to prevent flickering
                                        //when the mouse is moving over the same country
                                        if(hovered_over_country != previous_hovered_country)
                                        {
                                            previous_hovered_country = hovered_over_country;
                                            update_fuel_sunburst("sunburst_g", fuel_sunburst, hovered_over_country);
                                            update_radar_chart( "fuel_radar", fuel_radar_cfg, hovered_over_country);
                                            update_country_profile(hovered_over_country);
                                        }
                                })
                    .on('mouseout',//When the mouse is out of a country
                        function()
                        {
                            //Remove tooltip
                            tooltip.classed('hidden', true);

                            //Remove colouring for selected countries
                            d3.select(selectedCountry)
                            .style({
                                      'fill-opacity':1
                                   });
                        });

        //Display the current year on the map
        d3.selectAll("#countries").append("text")
                                   .attr("id", "year_text")
                                   .attr("x", 15)
                                   .attr("y", 400)
                                   .text("1990")
                                   .attr("font-family", "sans-serif")
                                   .attr("font-size", "60px")
                                   .attr("fill", "black");

        //The gradient color key. I used an excellent tutorial:
        //http://www.visualcinnamon.com/2016/05/smooth-color-legend-d3-svg-gradient.html
        //Also, this one: http://bl.ocks.org/darrenjaworski/5397362
        var linearGradient = //d3.selectAll("#countries")
                               map_svg.append("defs")
                               .append("svg:linearGradient")
                               .attr("id", "gradient")
                               .attr("x1", "0%")
                               .attr("y1", "0%")
                               .attr("x2", "100%")
                               .attr("y2", "0%")
                               .attr("spreadMethod", "pad");

        //The color key that explains a country's color
        var colorScale = d3.scale.log()
                                 .range(["darkgreen", "yellow","red"]);

        //Append multiple color stops by using D3's data/enter step
        linearGradient.selectAll("stop")
                    .data( emissions_scale.range() )
                    .enter().append("stop")
                    .attr("offset", function(d,i) { return i/(emissions_scale.range().length-1); })
                    .attr("stop-color", function(d) { return d; });


        //Draw the rectangle and fill with gradient
        d3.selectAll("#countries")
          .append("rect")
          .attr("width", 300)
          .attr("height", 15)
          .attr("x", 300)
          .attr('y', 410)
          .style("fill", "url(#gradient)");

        //Create axis below it, for values. A log axis
        //http://stackoverflow.com/questions/15636526/set-custom-x-axis-labels-in-d3-bar-charts
        var axis_legend = ["0", "100K", "300K", "500K", "1M", "2M", "3M", "6M", "12M"];

        //A function that returns the axis'tick text
        var formatEmissions = function(d)
                        {
                            return axis_legend[d];
                        }

        //the axis scale. range 0-->300 for a 300 pixles wide key, domain 0-->8 for a 9 tick axis
        var gradient_axis_scale = d3.scale.linear()
                                          .range([0, 300])
                                          .domain([0, 8]);

        //Axis to be put below the color gradient key to explain it
        var gradient_axis = d3.svg.axis().scale(gradient_axis_scale)
                                  .orient("bottom").ticks(9).tickFormat(formatEmissions);

        map_svg.append("g")
               .attr("class", "axis")
               .attr("transform", "translate(300,425)")
               .call(gradient_axis)
               .append("text")
               .attr('x', 305)
               .attr('y', 2)
               .attr('fill', 'black')
               .text("Tonnes of CO2");

        });//end of d3.json()

//*****************************************************************************************
//*****************************************************************************************
//Map Coulouring
var numeric_params = ["emissions_per_capita", "total_emissions"];
color_metric = 'total_emissions'

//function to extract data by year, for the animation. It will format the data appropriately
function get_year_data(data_array, year)
{
    //Group data by country and metric
    data_group_by_metric = d3.nest()
                                    .key(function(d)
                                        {
                                            return d.country;
                                        })
                                    .key(function(d)
                                        {
                                            return d.metric;
                                        })
                                    .entries(data_array)
    temp_arr = []; //Function's return variable, will hold country data
    temp_element = {}; //Used to fill the temp_arr

    //Loop over each country
    for(var k1 of data_group_by_metric.keys())
    {
        temp_element["name"] = html_compatible_id(data_group_by_metric[k1].key);

        //Loop over each metric
        for (var k2 of data_group_by_metric[k1].values.keys() )
        {
            param = data_group_by_metric[k1].values[k2].key;
            temp_element[param] = +data_group_by_metric[k1].values[k2].values[0][year];
        }

        //Skip Central Africa, a huge outlier, makes all other nations seem too small on the graph
        //if(temp_element['name'] != "Central African Republic")
        if( temp_element.name != "Lowincome" &&
            temp_element.name != "Lowermiddleincome" &&
            temp_element.name != "Middleincome" &&
            temp_element.name != "Palau" && //Exclude too countries with extremely low emissions, they distort the colouring scale
            temp_element.name != "MarshallIslands" &&
            temp_element.name != "NorthernMarianaIslands" &&
            temp_element.name != "TurksandCaicosIslands" &&
            temp_element.name != "Micronesia" &&
            temp_element.name != "FaroeIslands" )
        {
            //Verify if the country has any unspecified\missing metric for this year
            var has_empty_param = false;

            for(var i in numeric_params)
            {
                var element_param = numeric_params[i];
                if (isNaN(temp_element[element_param]) || temp_element[element_param] == 0 )
                {
                    has_empty_param = true;
                    break;
                }
            }

            //If the country has all the data full, push it into the return array
            if(has_empty_param == false)
            {
                //Add the element to the array to be returned
                temp_arr.push(temp_element);
            }//if the country has both values available this year

        }//if not any aggregation entity

        //Reset temp element for next loop. Not sure why, but it doesn't work otherwise
        //I was expecting that it would just overwrite the older value and no need
        //to clear the temp_element.
        temp_element = {};
    }
    return temp_arr;
}

//A function that updates the map colors every certain period of time
function draw_map_by_year(data, year)
{
    //Get this year's data
    current_year = get_year_data(data, year);

    //Update map's year text
    d3.selectAll("#year_text").text(year)
                                   .attr("font-family", "sans-serif")
                                   .attr("font-size", "60px")
                                   .attr("fill", "black");

    d3.selectAll("path")
      .datum(function(d)
            {
                return {"name" : d3.select(this).attr("id")};
            })
      .data(current_year, //Ensure we map correctly
          function(d, i)
          {
              return d.name;
          })
      .transition()
      //The reason that it is 500 and not 750 as the update interval is that I want to color
      //transition be noticeably stable before the start of next year's transition
      .duration(500)
      .style('fill',
              function(d)
              {
                  return emissions_scale(d.total_emissions);
              });
}


//WORLD EMISSIONS HISTORICAL DATA. Call the update map every 750 ms
d3.csv("data/country_data.csv", function(data)
{
    country_emissions_data = data;
    //Do the animation
    var start_year = 1990;
    var end_year = 2011;
    var current_year = 1990;

    var year_interval_mapping = setInterval(function()
                                            {
                                                draw_map_by_year(country_emissions_data,
                                                             current_year);
                                                current_year++;
                                                if(current_year > end_year)
                                                {
                                                    clearInterval(year_interval_mapping);
                                                }
                                            },
                                            750);
});

/***********************************************************************\
*************************************************************************
                        SELECTED COUNTRY PROFILE
                        WORKS ON 2011 DATA ONLY
*************************************************************************
\***********************************************************************/

/*The country profile is the dashboard below the map. It contains:
 - Selected Country Name (It starts with the whole world)
 - Population
 - GDP
 - circular meters for GDP per capita, CO2 per capita, Emissions productivity and total emissions
 - Percentage of the country's population
 - Percentage of the country's emissions (in respect to the world)
 - The breakdown of the gases that make up the selected country's emissions
*/
//Build graphics
//COUNTRY 2011 DATA


//GRAPHICS FOR THE COUNTRY PROFILE
//cp_ prefix stands for country profile
var cp_svg_cfg = {
                        total_width : 700,
                        total_height : 300,
                        margin : {top: 0, right: 0, bottom: 0, left: 0},
                        width : 700,
                        height : 300,
                        fill: "lightBlue"
                  }

var cp_svg = create_svg("country_profile_div", cp_svg_cfg);

//A function to extract only the needed parameters for the CP section.
function get_country_profile_data(country_name)
{
    data = get_country_data(world_2011_data, country_name);
    ret_data = {};

    emissions_productivity = data.gdp /(data.total_emissions);//Multiply by 1000 to convert from kT to T

    hierarchical_data = [
                        {name: "gdp_per_capita", text: "GDP Per Capita", unit: "US$/Capita", value: data.gdp_per_capita, maximum : 101000},
                        {name: "co2_per_capita", text: "CO2 Per Capita", unit: "Tonnes/Capita", value: data.co2_per_capita, maximum : 44},
                        {name: "emissions_productivity", text: "Emissions Productivity", unit: "US$/T of CO2", value: emissions_productivity, maximum : 8000000},
                        {name: "total_emissions", text: "Total Emssions", unit: "kT of CO2 Eq.", value: data.total_emissions, maximum : 12064260},

                        ]

    return hierarchical_data;
}

//Initialize the CP's main svg g section. It will create the elements in their initial state,
//and then these elements will be updated by a different function when a new country is selected.
function init_country_profile_g(svg_elemet)
{
    var country_profile_data = get_country_profile_data("World");

    var country_profile_g = svg_elemet.append("g")

    var cp_font_size = "20px"

    //Country name text
    var cp_country_name = svg_elemet.append("g").append("text")
                                           .attr("id", "cp_name")
                                           .attr("x", 5)
                                           .attr("y", 55)
                                           .text("World")
                                           .attr("font-family", "sans-serif")
                                           .attr("font-size", "40px")
                                           .attr("fill", "black");

    //Country popuation text
    var cp_country_population = svg_elemet.append("g").append("text")
                                           .attr("id", "cp_population")
                                           .attr("x", 5)
                                           .attr("y", 90)
                                           .text("Population: 7 Billion")
                                           .attr("font-family", "sans-serif")
                                           .attr("font-size", cp_font_size)
                                           .attr("fill", "black");

    //Country GDP text
    var cp_country_gdp = svg_elemet.append("g").append("text")
                                           .attr("id", "cp_gdp")
                                           .attr("x", 5)
                                           .attr("y", 120)
                                           .text("GDP: 72.818 Trillion USD")
                                           .attr("font-family", "sans-serif")
                                           .attr("font-size", cp_font_size)
                                           .attr("fill", "black");

    //Two, large fonted, texts that will display a country's share of world's population
    //and emissions
    var cp_country_emissions_perc = svg_elemet.append("g").append("text")
                                           .attr("id", "cp_emssions_perc")
                                           .attr("x", 355)
                                           .attr("y", 65)
                                           .text("")
                                           .attr("font-family", "sans-serif")
                                           .attr("font-size", "45px")
                                           .attr("fill", "black");

    var cp_country_population_perc = svg_elemet.append("g").append("text")
                                           .attr("id", "cp_population_perc")
                                           .attr("x", 355)
                                           .attr("y", 130)
                                           .text("")
                                           .attr("font-family", "sans-serif")
                                           .attr("font-size", "45px")
                                           .attr("fill", "black");

    //The text that explains the big percentages. Initially hidden, since the initial display
    //is for the whole world, it doesn't make sense to put two 100%
    var cp_country_population_perc = svg_elemet.append("g").append("text")
                                           .attr("class", "cp_explaination_text")
                                           .attr("x", 485)
                                           .attr("y", 65)
                                           .text("of the world's emissions")
                                           .attr("font-family", "sans-serif")
                                           .attr("font-size", "10px")
                                           .attr("fill", "black");

    var cp_country_population_perc = svg_elemet.append("g").append("text")
                                           .attr("class", "cp_explaination_text")
                                           .attr("x", 485)
                                           .attr("y", 130)
                                           .text("of the world's population")
                                           .attr("font-family", "sans-serif")
                                           .attr("font-size", "10px")
                                           .attr("fill", "black");

    d3.selectAll(".cp_explaination_text").attr("display", "none");

}

//A function that creates the radial meters. This function creates an arc object that will be used
//to draw the circles and fill them. This arc will create as many meters as the length of its
//passed data. Since get_country_profile_data returns an array of length 4, this arc will create
//4 meters, one for each entry. Not sure if this is a better choice than creating each one alone,
// but certainly this way is simpler and less repeated code. So less code, less complication but
//less flexibility
function init_cp_meters(svg_elemet)
{
    //https://codepen.io/rogerxu/pen/rLqvd
    cp_data = get_country_profile_data("World");

    //Append the data and set the attributes the progess meters
    var radial_meter = svg_elemet.selectAll(".progress_meter")
                                 .data(cp_data).enter()
                                 .append("g")
                                 .attr("transform", function(d, i)
                                                {
                                                    var x = i*150 + 70;
                                                    var y = 220;
                                                    return "translate("+ x + ", " + y + ")" ;
                                                })
                                 .attr('class', 'progress_meter')
                                 .attr('id', name).each(save_vals);

    //Arc function that will draw the meters. All its parameters are set except for the end angle,
    //which it will get from the passed data.
    var arc = d3.svg.arc()
                    .startAngle(0)
                    .innerRadius(50)
                    .outerRadius(60)
                    .endAngle(function(d, i)
                              {
                                    return Math.PI * 2 * (d.value/d.maximum);
                              });

    //We have two types of scales, one where the lower value is a good thing (Like amound of emissions)
    // and another where lower values are not good (Like GDP, lower means poorer). So to make the
    //colors reflect this, two different linear scales were created
    var meter_color_scale = d3.scale.linear()
                                  .domain( [0, 0.5, 1]).range(["darkgreen",  "yellow", "red"]);

    var inverse_meter_color_scale = d3.scale.linear()
                                  .domain( [0, 0.5, 1]).range(["red",  "yellow", "green"]);

    meter_fill = radial_meter.append('path')
                             .attr("id", "meter_path")
                             .attr('class', 'foreground')
                             .style('fill', function(d)
                                            {
                                                if (d.name == "gdp_per_capita" || d.name == "emissions_productivity")
                                                {
                                                    return inverse_meter_color_scale(d.value/d.maximum);
                                                }
                                                else
                                                {
                                                    return meter_color_scale(d.value/d.maximum);
                                                }

                                            })
                             .style('fill-opacity', 0.8)
                             .attr('d', arc);

    //Once created, I don't want the label to change, this is why it will not be given an ID
    radial_meter.append('text')
                .attr('fill', '#fff')
                .text(function(d) { return d.text; })
                .style("text-anchor", "middle")
                .style("font-size", 12)
                .style("fill", "black")


    //Meter value text
    meter_text_value = radial_meter.append('text')
                                    .attr('class', 'text_val')
                                    .attr('fill', '#fff')
                                    .attr("y", 20 )
                                    .text(function(d, i) { return (d.value).toFixed(1); })
                                    .style("text-anchor", "middle")
                                    .style("font-size", 18)
                                    .style("fill", "green")

    //Once created, this text will not be changed. It is the unit of the meter value
    radial_meter.append('text')
                .attr('fill', '#fff')
                .attr("y", 40 )
                .text(function(d) { return d.unit; })
                .style("text-anchor", "middle")
                .style("font-size", 9)
                .style("fill", "black")

    return {cp_arc : arc}

}

//A global variable that will hold the cp_meters parameters. Currently, it will hold only the
//arc used to create the meters. This arc is reused for updating the meters
var cp_meters = {};

//Function that updates the meters. It updates using tweening, so that it is a smooth transition
function update_cp_meters(svg_elemet, country, meters)
{
    //Recreate the scales used in creating the meters.
    var meter_color_scale = d3.scale.log()
                              .domain( [0.05, 0.2, 1]).range(["darkgreen",  "orange", "red"]);

    var inverse_meter_color_scale = d3.scale.log()
                                  .domain( [0.01, 0.2, 1]).range(["red",  "yellow", "green"]);

    //Get hovered over country's data
    cp_data = get_country_profile_data(country);
    meters = svg_elemet.selectAll(".progress_meter")

    //Save current values. Tweening requires two things: 1) current values and 2) Next values
    //Then it will compute everything in between. The next value is set to the object, overwriting
    //the current value, and this is why we need to save it elsewhere
    meters.each(save_vals);

    //Push the new data, with the next values
    svg_elemet.selectAll(".progress_meter")
              .data(cp_data).enter();

    //Update text value for the meters
    svg_elemet.selectAll(".text_val")
              .data(cp_data)
              .text(function(d, i)
                    {
                        return (d.value).toFixed(1);
                    })

    svg_elemet.selectAll("path")
          .data(cp_data)
          .style('fill', function(d)
                        {
                            if (d.name == "gdp_per_capita" || d.name == "emissions_productivity")
                            {
                                return inverse_meter_color_scale(d.value/d.maximum);
                            }
                            else
                            {
                                return meter_color_scale(d.value/d.maximum);
                            }
                        })
          .attr("d", cp_meters.cp_arc)
          .transition()
          .duration(450)
          .attrTween("d", cp_meters_arcTween);
}

//A function that will tween the meters. It will make the transitions smoother
function cp_meters_arcTween(d, i, b)
{
    meters = cp_svg.selectAll(".progress_meter"); //get the objects to be tweened
    current_val = meters[0][i]._current; //get current values

    //Create a function that takes as input a number between 0 and 1, 0 = current value and 1 being
    //the next value. Any value in between it returns an intermediate value that represents
    //this part of the transition
    var interpolater = d3.interpolate(current_val.value, d.value);

    //t for time. It is the transition time, from 0 to 1. So if the transition is 750 ms,
    //t = 1 when 750 ms have passed
    return function(t)
    {
        //The arc function needs to be passed the index of the meter, current value and maximum.
        //The latter two must be passed in an object format.
        max = meters[0][i]._current.maximum;
        var tween_angle_val = {value: interpolater(t), maximum: max};

        return cp_meters.cp_arc(tween_angle_val, i);
    };
}
//*****************************************************************************************
//Emissions gases breakdown bar

//A function that returns the percentages of each gas. Will be used for the stacked bars
function get_emission_gases_stacked_data(country)
{
    data = get_country_data(world_2011_data, country);
    stacked_gases_data = {}

    //For some reasons number don't add up, total_emissions != co2+no2+methan+other. I will recompute the total
    total_gases = data.total_other_gases + data.total_co2 + data.total_methane + data.total_no2;

    bar_data = [
                    {
                        name: country,
                        CO2: data.total_co2/ total_gases,
                        Methane: data.total_methane/ total_gases,
                        NO2: data.total_no2/ total_gases,
                        Other: data.total_other_gases/ total_gases
                    }
                ]

    //The fields for the stack bar. A stacked bar needs the data in a special format, an
    //array of of objects of arrays. This next part creates that
    var fields = ["CO2", "Methane", "NO2", "Other"];

    var mapped_gases_data = fields.map(function(key, index)
                                       {
                                            return bar_data.map(function(d,i)
                                                                {
                                                                   return {
                                                                               x: d.name,
                                                                               y: d[key],
                                                                               gas_type: key
                                                                           };
                                                                })
                                      });

    //Transform it into SVG x, y and y0. The following function computes the y0
    stacked_gases_data = d3.layout.stack()(mapped_gases_data);

    //Return the appropriately stacked data
    return stacked_gases_data;
}

//Initiate the gases breakdown stacked bar. It will create the initial value, and another function
//will update the stacks as a new country is selected
function init_stacked_emissions_gases(svg_elem)
{
    var axis_x_position = cp_svg_cfg.width - 100;
    var axis_y_position = cp_svg_cfg.height - 300;

    var x_stack_scale = d3.scale.ordinal()
                          .rangeRoundBands([0, 10], .1);

    var y_stack_scale = d3.scale.linear()
                          .rangeRound([cp_svg_cfg.height - 30, 30]);

    var gases_stack_color = d3.scale.category20();

    var x_axis_stack = d3.svg.axis()
                             .scale(x_stack_scale)
                             .orient("bottom");

    stacked_data = get_emission_gases_stacked_data("World");

    var stacked_layers = svg_elem.selectAll(".layer")
                                 .data(stacked_data)
                                 .enter().append("g")
                                 .attr("class", "layer")
                                 .style("fill", function(d, i) { return gases_stack_color(i); });

    //Tooltip for the  gases
    var barTooltip = d3.select("#country_profile_div").append("div")
                       .attr("class", "hidden tooltip");

    //http://bl.ocks.org/mbostock/1134768
    stacked_layers.selectAll("rect")
                  .data( function (d) {return d;})
                  .enter().append("rect").attr("class", "gases_bar")
                  .attr("x", function (d)
                             {
                                return axis_x_position  ;

                             })
                  .attr("y", function (d)
                             {
                                  return y_stack_scale(d.y + d.y0);
                             })
                  .attr("height", function (d)
                                  {
                                      return y_stack_scale(d.y0) - y_stack_scale(d.y + d.y0);
                                  })
                  .attr("width",  x_stack_scale.rangeBand())
                  .on("mousemove", function(d)
                                  {
                                       var mouse = d3.mouse(svg_elem.node()).map(function(d)
                                        {
                                            return parseInt(d);
                                        });

                                        hoveredOverBar = this;

                                        tooltip_string = d.gas_type + " : " + (d.y*100.0).toFixed(0) + "%";

                                        d3.select(hoveredOverBar).style('fill-opacity', 0.7);

                                        barTooltip.classed('hidden', false)
                                            .attr('style', 'left:' + (mouse[0] + 2) +
                                                    'px; top:' + (mouse[1] + 425) + 'px')
                                            .html(tooltip_string);
                                  })
                  .on('mouseout',
                        function()
                        {
                            //Remove tooltip
                            barTooltip.classed('hidden', true);

                            //Remove colouring for selected countries
                            d3.select(hoveredOverBar)
                            .style({
                                      'fill-opacity': 1
                                   });
                        });

    svg_elem.append("g")
            .attr("class", ".axis")
            .attr("transform", "translate(" + axis_x_position + ", " + axis_y_position + " )")
            .call(x_axis_stack)
            .append("text")
            .attr("x", -10)
            .attr("y", 285)
            .text("Emissions Gas %")
            .attr("fill", 'black');
}

//Update the stacked emissions bars. Called when a new country is hovered over
function update_stacked_emissions_gases(svg_elem, country)
{
    var axis_x_position = cp_svg_cfg.width - 100;
    var axis_y_position = cp_svg_cfg.height - 300;

    var x_stack_scale = d3.scale.ordinal()
                          .rangeRoundBands([0, 10], .1);

    var y_stack_scale = d3.scale.linear()
                          .rangeRound([cp_svg_cfg.height - 30, 30]);

    //Update data
    stacked_data = get_emission_gases_stacked_data(country);

    var barTooltip = d3.select("#country_profile_div").append("div")
                       .attr("class", "hidden tooltip");
    //update
    svg_elem.selectAll('.gases_bar')
            .data(stacked_data)
            .transition()
            .attr("x", function (d)
                       {
                          return axis_x_position  ;
                       })
            .attr("y", function (d)
                       {
                        //I am not sure why, but the data returned is not direct, it is
                        //an array and the data is contained in the first element, this
                        //why we do d[0].y and d.y
                            return y_stack_scale(d[0].y + d[0].y0);
                       })
            .attr("height", function (d)
                            {
                                return y_stack_scale(d[0].y0) - y_stack_scale(d[0].y + d[0].y0);
                            })
            .attr("width",  x_stack_scale.rangeBand())

      svg_elem.selectAll('.gases_bar')
              .on("mousemove", function(d)
                      {
                           var mouse = d3.mouse(svg_elem.node()).map(function(d)
                            {
                                return parseInt(d);//here d works directly, without the d[0]
                            });

                            hoveredOverBar = this;

                            tooltip_string = d[0].gas_type + " : " + d[0].y.toFixed(2)*100.0 + "%";

                            d3.select(hoveredOverBar).style('fill-opacity', 0.7);

                            barTooltip.classed('hidden', false)
                                .attr('style', 'left:' + (mouse[0] + 2) +
                                        'px; top:' + (mouse[1] + 425) + 'px')
                                .html(tooltip_string);
                      })
              .on('mouseout', function()
                              {
                                  //Remove tooltip
                                  barTooltip.classed('hidden', true);

                                  //Remove colouring for selected countries
                                  d3.select(hoveredOverBar)
                                  .style({
                                            'fill-opacity': 1
                                         });
                              });

}

//A formatting function for the population and GDP text. Values come in different ranges, so
//this function converts the value into numeric-textual values. FOr example, 1000000 will be
//converted to 1.000000 Million
function get_range_in_letters(num)
{
    ret_obj = { range_str: "", divisor : 1, decimal_points : 1 }

    if (num < 1000000 && num >= 1000)
    {
        ret_obj.range_str = " Thousands";
        ret_obj.divisor = 1000;
        ret_obj.decimal_points = 1;
    }
    else if (num < 1000000000 && num >= 1000000)
    {
        ret_obj.range_str = " Millions";
        ret_obj.divisor = 1000000;
        ret_obj.decimal_points = 1;
    }
    else if (num < 1000000000000 && num >= 1000000000)
    {
        ret_obj.range_str = " Billions";
        ret_obj.divisor = 1000000000;
        ret_obj.decimal_points = 1;
    }
    else if (num >= 1000000000000)
    {
        ret_obj.range_str = " Trillions";
        ret_obj.divisor = 1000000000000;
        ret_obj.decimal_points = 2;
    }

    return ret_obj
}

//A function that updates all the country profile section. It basically calls everything else with
//the right value. This function is called in turn when a new country is hovered over by the mouse
function update_country_profile(country)
{
  //Get the country's data
    data = get_country_data(world_2011_data, country);

    //Create the formatting objects for the population and gdp texts
    population_text_format = get_range_in_letters(data.population);
    gdp_text_format = get_range_in_letters(data.gdp);

    //Update the country name, population and gdp texts
    d3.selectAll("#cp_name").text(country);
    d3.selectAll("#cp_population").text( "Population: " + (data.population/population_text_format.divisor).toFixed(population_text_format.decimal_points) + population_text_format.range_str);
    d3.selectAll("#cp_gdp").text( "GDP: " + (data.gdp/gdp_text_format.divisor).toFixed(gdp_text_format.decimal_points) + gdp_text_format.range_str + " US$");

    //Update the country share's percentages and make them visible, if it is the first time
    //since they start out hidden
    world_total_emissions = 52049851.2;
    country_emissions_perc = data.total_emissions*100.0/world_total_emissions;
    d3.selectAll("#cp_emssions_perc").text( (country_emissions_perc).toFixed(1) + "%");

    world_total_population = 7000000000;
    country_population_perc = data.population*100.0/world_total_population;
    d3.selectAll("#cp_population_perc").text( (country_population_perc).toFixed(1) + "%");

    d3.selectAll(".cp_explaination_text").attr("display", "true");

    //Make a little adjustment for the text position, since sometimes values are too big
    //and the two texts (percentages and explanation text) become displayed one over another
    if( (country_emissions_perc < 10.0) && (country_population_perc < 10.0) )
    {
        d3.selectAll(".cp_explaination_text").attr("transform", "translate(-20,0)");
    }
    else
    {
        d3.selectAll(".cp_explaination_text").attr("transform", "translate(0,0)");
    }

    //Update the circular meters and te gases breakdown
    update_cp_meters(cp_svg, country, cp_meters);
    update_stacked_emissions_gases(cp_svg, country)
}

/***********************************************************************\
*************************************************************************
                  GRAPHICS FOR THE COUNTRY RADIAL PLOTS
*************************************************************************
\***********************************************************************/
//*****************************************************************************************
//crp_ prefix stands for country radial plot
//TODO: Change it to cfp, country fuel profile
var crp_svg_cfg = {
                        total_width : 400,
                        total_height : 450,
                        margin : {top: 0, right: 0, bottom: 0, left: 0},
                        width : 400,
                        height : 750,
                        fill: "lightBlue"
                  }

var crp_svg = create_svg("country_radial_graphs_div", crp_svg_cfg);

//-------------------------------------------------------------
//Fuel Sunburst

//A function to extract the fuel data and create a nested JSON form for sunburst display
function get_fuel_data(world_data, country_name)
{
    data = get_country_data(world_data, country_name);

    //If there are not nuclear power, do not display its text
    if(data.electricity_from_nuclear == 0)
    {
        nuclear_text = "";
    }
    else
    {
        nuclear_text = "Nuclear"
    }

    //If no fossil fuel , do not display its text
    if(data.electricity_from_coal == 0 &&
        data.electricity_from_oil == 0 &&
        data.electricity_from_gas == 0)
    {
        fossil_text = "";
    }
    else
    {
        fossil_text = "Fossil"
    }

    //Renewable
    if(data.electricity_from_hydro == 0 &&
        (data.electricity_from_renewable - data.electricity_from_hydro) == 0)
    {
        renewable_text = "";
    }
    else
    {
        renewable_text = "Renewable"
    }

    if(data.electricity_from_coal == 0)
    {
        coal_text = "";
    }
    else
    {
        coal_text = "Coal"
    }

    if(data.electricity_from_oil == 0)
    {
        oil_text = "";
    }
    else
    {
        oil_text = "Oil"
    }

    if(data.electricity_from_gas == 0)
    {
        gas_text = "";
    }
    else
    {
        gas_text = "Gas"
    }

    if(data.electricity_from_hydro == 0)
    {
        hydro_text = "";
    }
    else
    {
        hydro_text = "Hydro"
    }

    if((data.electricity_from_renewable - data.electricity_from_hydro) == 0)
    {
        other_renewable_text = "";
    }
    else
    {
        other_renewable_text = "Other"
    }


    hierarchical_data =
    {
        "name": "fuel_data",
        "text": "",
        "children":
        [
            {
                "name": "Fossil Fuel",
                "text": fossil_text,
                "children":
                [
                    { "name":"Coal", "size" : data.electricity_from_coal, "text": coal_text },
                    { "name":"Oil", "size" : data.electricity_from_oil, "text": oil_text },
                    { "name":"Gas", "size" : data.electricity_from_gas, "text": gas_text }
                ]
            },
            {
                "name": "Renewable Energy",
                "text": renewable_text,
                "children":
                [
                    { "name":"HydroElectricity", "size" : data.electricity_from_hydro, "text": hydro_text },
                    { "name":"Other Renewables", "size" : data.electricity_from_renewable - data.electricity_from_hydro, "text": other_renewable_text }
                ]
            },
            {
                "name":"Nuclear Energy", "size" : data.electricity_from_nuclear, "text": nuclear_text
            }
        ]
    }

    return hierarchical_data;
}



//The fuel used to generate power sunburst
function init_fuel_sunburst()
{
    //A function that initiates the sunburst stuff, like scales and all
    //X and Y Scales, to be used for drawing the arcs

    fuel_sunburst_rad = Math.min(crp_svg_cfg.height, crp_svg_cfg.width) / 2.25;

    var sunburst_x_scale = d3.scale.linear()
                             .range([0, 2 * Math.PI]);
    var sunburst_y_scale = d3.scale.linear()
                             .range([0, fuel_sunburst_rad]);

    //Partitioning the data, to be used in a hierarchical form
    var fuel_sunburst_partition = d3.layout.partition()
                                           .value(function(d)
                                                  {
                                                      return d.size;
                                                  });

    //Arc object, responsible to create the "d" of the path for ALL arcs in the sunburst
    var sunburst_arc = d3.svg.arc()
                            .startAngle(function(d)
                                        {
                                            return Math.max(0, Math.min(2 * Math.PI, sunburst_x_scale(d.x)));
                                        })
                            .endAngle(function(d)
                                      {
                                          return Math.max(0, Math.min(2 * Math.PI, sunburst_x_scale(d.x + d.dx)));
                                      })
                            .innerRadius(function(d)
                                         { //fuel_sunburst_rad * (d.y)*(d.y) / 10000;//
                                             return Math.max(0, sunburst_y_scale(d.y) - (35 - (d.depth) ));
                                         })
                            .outerRadius(function(d)
                                         {//fuel_sunburst_rad * (d.y + d.dy)*(d.y + d.dy) / 10000;//
                                             return Math.max(0, sunburst_y_scale(d.y + d.dy) - (35 - Math.sqrt(d.depth*9) ) );
                                         });

    var fuel_colors =  {
                            "fuel_data": "black",
                            "Fossil Fuel": "red",
                                "Coal": "#4d0000",
                                "Oil": "#eb0000",
                                "Gas": "#f44343",
                            "Renewable Energy": "green",
                                "HydroElectricity": "#007deb",
                                "Other Renewables": "#95eb00",
                            "Nuclear Energy": "#ebcb00"
                        }

    return {x_scale: sunburst_x_scale,
            y_scale: sunburst_y_scale,
            partitions: fuel_sunburst_partition,
            arc: sunburst_arc,
            color_code: fuel_colors}
}


//Since it is a circle, we need to adjust the rotation of the text
function computeTextRotation(x_scale, d)
{
    return (x_scale(d.x + d.dx / 2) - Math.PI / 2) / Math.PI * 180;
}

//Save current values for tweening
function save_vals(d)
{
    this._current = d;
}

//create the sunburst object
var fuel_sunburst = init_fuel_sunburst();

//a function to create the g sections for the cp svg
function init_sunburst_g(svg_elemet, sunburst_elem, fill_data)
{
    //Text title
    var sunburst_title = svg_elemet.append("g")
                                   .append("text")
                                   .attr("x", 5)
                                   .attr("y", 10 + crp_svg_cfg.height/2)
                                   .text("Electricity Generation by Source:")
                                   .attr("font-family", "sans-serif")
                                   .attr("font-size", "20px")
                                   .attr("fill", "black");

    //Fuel Sunburst
    var fuel_sunburst_g = svg_elemet.append('g')
                                .attr("id", "sunburst_g")
                                .attr("transform", "translate(" + crp_svg_cfg.width / 2 + "," + (crp_svg_cfg.height) * 3 / 4 + ")");

    //Create the inital sunburst, ie create the paths,
    fuel_sunburst_g.selectAll("path")
                   .data(sunburst_elem.partitions.nodes(fill_data))
                   .enter()
                   .append("path")
                   .attr("d", sunburst_elem.arc)
                   //.attr("fill-rule", "evenodd")
                   .style("fill", function(d)
                                 {
                                     return sunburst_elem.color_code[d.name];
                                 })
                   .each(save_vals)

    fuel_sunburst_g.selectAll("text")
                .data(sunburst_elem.partitions.nodes(fill_data))
                .enter()
                .append("text")
                .attr("transform", function(d)
                                    {
                                        return "rotate(" + computeTextRotation(sunburst_elem.x_scale, d) + ")";
                                    })
                .attr("x", function(d)
                                    {
                                        return sunburst_elem.y_scale(d.y);
                                    })
                .attr("dx", "1") // margin
                .attr("dy", ".35em") // vertical-align
                .attr("font-size", "11")
                .text(function(d)
                      {
                        return d.name;
                      });
}

function update_fuel_sunburst(fuel_g_id, sunburst_element, country)
{
    var sunburst_fuel_data = get_fuel_data(world_2011_data, country);

    fuel_g = d3.selectAll("#" + fuel_g_id);

    var sunburst_path = fuel_g.selectAll("path")
                                  .data(sunburst_element.partitions.nodes(sunburst_fuel_data))
                                  .attr("d", sunburst_element.arc)
                                  .transition()
                                  .duration(450)
                                  .attrTween("d", sunburstArcTween);

    var text = fuel_g.selectAll("text")
                .data(sunburst_element.partitions.nodes(sunburst_fuel_data))
                .attr("transform", function(d)
                                    {
                                        return "rotate(" + computeTextRotation(sunburst_element.x_scale, d) + ")";
                                    })
                .attr("x", function(d)
                                    {
                                        return sunburst_element.y_scale(d.y) - 30;
                                    })
                .text(function(d)
                      {
                        return d.text;
                      })
                .style('fill', 'darkOrange');
}


function sunburstArcTween(d)
{
    var interpolater = d3.interpolate({x: this._current.x, dx: this._current.dx},
                                       d);

    this._current = interpolater(0);

    return function(t)
    {
         return fuel_sunburst.arc(interpolater(t));
    };
}


//***************************************************************************************
//radar chart
//This chart shows how fossil fuel is used for.
var fuel_stacked_data = []

function init_fuel_radar_data()
{
    //The regions data is constant, this is why I will separate the population of regional
    //data and country data.
    //name
    //electricity_and_heat_fuel_perc
    //manufacturing_construction_fuel_perc
    //residential_commercial_public_fuel_perc
    //transportation_fuel_perc
    //other_sectors_fuel_perc

    var world_fuel_sectors = get_country_data(world_2011_data, "World");
    var low_income_fuel_sectors = get_country_data(world_2011_data, html_compatible_id("Low income"));
    var middle_income_fuel_sectors = get_country_data(world_2011_data, html_compatible_id("Middle income"));
    var high_income_fuel_sectors = get_country_data(world_2011_data, html_compatible_id("High income"));
    //A place holder to be updated with the country data
    var country_fuel_sectors = get_country_data(world_2011_data, "World");

    var all_arr = [ country_fuel_sectors //Add here world_fuel_sectors, low_income_fuel_sectors..etc if you want to show them on the radar
                     ];
    var params = {
                     "Electricity and Heat" : "electricity_and_heat_fuel_perc",
                     "Buildings" : "residential_commercial_public_fuel_perc",
                     "Manuf. and Constr." : "manufacturing_construction_fuel_perc",
                     "Transportation" : "transportation_fuel_perc",
                     "Other Sectors" : "other_sectors_fuel_perc"
                 }

    var temp_obj = {};
    var return_array = [];
    var temp_arr = [];

    for(var i in all_arr)
    {
        //reset the temporary place holder
        temp_arr = [];

        for(j in params)
        {
            //reset the temporary object
            temp_obj = {"axis":"", "value" : 0};
            temp_obj["axis"] = j;
            temp_obj["value"] = all_arr[i][params[j]];
            temp_arr.push(temp_obj);
        }

        //Add it the the return array
        return_array.push(temp_arr);
    }
    fuel_stacked_data = return_array;

    return return_array;
}

function update_fuel_stacked_data(country_name)
{
    var country_data = get_country_data(world_2011_data, country_name);
    //I don't get it why when an object is nested inside an array in a function, I have to reset it
    // before being able to assign it a new value

    fuel_stacked_data[0][0]["value"] = country_data["electricity_and_heat_fuel_perc"];
    fuel_stacked_data[0][1]["value"] = country_data["residential_commercial_public_fuel_perc"];
    fuel_stacked_data[0][2]["value"] = country_data["manufacturing_construction_fuel_perc"];
    fuel_stacked_data[0][3]["value"] = country_data["transportation_fuel_perc"];
    fuel_stacked_data[0][4]["value"] = country_data["other_sectors_fuel_perc"];

}

function get_max_axis(data)
{
    var max_val = 0;
    for(var i in data)
    {
        for(var j in data[i])
        {
            max_val = Math.max(max_val, data[i][j].value);
        }
    }

    return max_val;
}

function get_axis_tick_range(maxValue)
{
    var before_decimal_point = maxValue.toString().split(".")[0];
    var factor = 1;

    if(before_decimal_point.length == 1 && before_decimal_point == '0')
    {
        console.log("check what comes after the decimal point, the number is less than 0")
        //see how many 0s there are after the decimal point
        var zeros_after_decimal = 1;
        var after_decimal_num = maxValue;
        factor = 1/zeros_after_decimal;
    }
    else
    {
        factor = Math.pow(10, before_decimal_point.length - 1);
    }
    return factor;
}


function init_fuel_radar_chart(svg_cfg, data)
{
    //parse ALL dataset to get the maximum possible value
    var data_max_val = get_max_axis(data);
    var maxValue = 60;//hard coded for nowdata_max_val  ;
    var radar_tick_factor = get_axis_tick_range(maxValue);
    var axis_level = Math.ceil(maxValue / (radar_tick_factor) ) ;//how many ticks per axis
    var radar_axis_max = axis_level * radar_tick_factor;

    var all_axis = (data[0].map(function(i, j){return i.axis})); //Names of each axis
    var total = all_axis.length; //The number of different axes
    var radar_radius = Math.min(svg_cfg.width/2, svg_cfg.height/2) - 50; //Radius of the outermost circle. 25 is to leave space for text
    var angle_slice = Math.PI * 2 / total;       //The width in radians of each "slice"

    var radar_rScale = d3.scale.linear()
                    .range([0, radar_radius])
                    .domain([0, radar_axis_max]);

    return  {
                axis_max: Math.ceil(maxValue / (radar_tick_factor) ) * radar_tick_factor,
                tick_factor: radar_tick_factor,
                axis_ticks_num:axis_level,
                radius: radar_radius,
                all_axis_names: all_axis,
                axis_angle_slice: angle_slice,
                r_scale: radar_rScale
            }
}

fuel_radar_cfg = {};

function init_radar_axis(svg_div, svg_cfg, chart_id, radar_cfg, translate_x, translate_y, data)
{
    //http://bl.ocks.org/nbremer/21746a9668ffdf6d8242
    var cx = svg_cfg.width/2;
    var cy = 10 + svg_cfg.height/4;

    var radar_title = svg_div.append("g")
                             .append("text")
                             .attr("x", 5)
                             .attr("y", 15)
                             .text("Fossil Fuel Usage by Sector:")
                             .attr("font-family", "sans-serif")
                             .attr("font-size", "20px")
                             .attr("fill", "black");

    var axisGrid = svg_div.append("g")
                          .attr("transform", "translate(" + cx + "," + cy + ")");

        //Create the straight lines radiating outward from the center
    var radar_axis = axisGrid.selectAll(".axis")
                             .data(radar_cfg.all_axis_names)
                             .enter()
                             .append("g");
    //Append the lines
    radar_axis.append("line")
              .attr("x1", 0)
              .attr("y1", 0 )
              .attr("x2", function(d, i){ return radar_cfg.r_scale(radar_cfg.axis_max) * Math.cos(radar_cfg.axis_angle_slice*i - Math.PI/2); })
              .attr("y2", function(d, i){ return radar_cfg.r_scale(radar_cfg.axis_max) * Math.sin(radar_cfg.axis_angle_slice*i - Math.PI/2); })
              .attr("class", "line")
              .style("stroke", "grey")
              .style("stroke-width", "1px");

    radar_axis.append("text")
        .attr("class", "legend")
        .style("font-size", "11px")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", function(d, i){ return radar_cfg.r_scale(radar_cfg.axis_max * 1.1) * Math.cos(radar_cfg.axis_angle_slice*i - Math.PI/2); })
        .attr("y", function(d, i){ return radar_cfg.r_scale(radar_cfg.axis_max * 1.1) * Math.sin(radar_cfg.axis_angle_slice*i - Math.PI/2); })
        .text(function(d){return d})

    //add the background circles
    axisGrid.selectAll("circle")
           .data(d3.range(1, radar_cfg.axis_ticks_num + 1).reverse())
           .enter().append("circle")
           .attr("r", function(d){return radar_cfg.r_scale(d * radar_cfg.tick_factor);})
           .style("fill", "grey")
           .style("fill-opacity",  function(d){ ;return (d / 100)} )
           .style("stroke", "black")
           .style("stroke-opacity", "0.2");

    //Text indicating at what % each level is
    axisGrid.selectAll(".axisLabel")
           .data(d3.range(1, radar_cfg.axis_ticks_num+1).reverse())
           .enter().append("text")
           .attr("class", "axisLabel")
           .attr("x", 4)
           .attr("y", function(d){return -radar_cfg.r_scale(d * radar_cfg.tick_factor); })
           .attr("dy", "0.4em")
           .style("font-size", "10px")
           .attr("fill", "grey")
           .text(function(d,i) { return d3.format('%')(d/10); });

    var radarLine = d3.svg.line.radial()
                               .interpolate("cardinal-closed")//"cardinal-closed" to make edges smoother
                               .radius(function(d) {  return radar_cfg.r_scale(d.value); })
                               .angle(function(d,i) {  return i * radar_cfg.axis_angle_slice; });

    var radarChart = svg_div.selectAll(".radarChart")
                            .data(data)
                            .enter().append("g")
                            .attr("class", ".radarChart")
                            .attr("transform", "translate(" + cx + "," + cy + ")")
                            .attr("id", chart_id);

    var color = d3.scale.ordinal()
                .range(["green","Blue","#00A0B0"]);

    radarChart.append("path")
              .attr("class", "radarArea")
              .attr("d", function(d,i) { return radarLine(d); })
              .style("stroke", function(d,i) { return color(i); })
              .style("stroke-width", "1px")
              .style("fill", function(d,i) { return color(i);} )
              .style("fill-opacity", function(d,i) { return 0.7 - (i*0.5);})

}


function update_radar_chart(chart_id, radar_cfg, country_name)
{
    update_fuel_stacked_data(country_name);

    var radarLine = d3.svg.line.radial()
                       //.interpolate("linear-closed")//"cardinal-closed" to make edges smoother
                       .interpolate("cardinal-closed")
                       .radius(function(d) {  return radar_cfg.r_scale(d.value); })
                       .angle(function(d,i) {  return i * radar_cfg.axis_angle_slice; });

    d3.select("#"+chart_id)
      .selectAll("path")
      .data(fuel_stacked_data)
      .transition()
      .duration(450)
      .attr("d", function(d,i) { return radarLine(d); })

}

d3.csv("/data/2011_data.csv", function(data)
{
    //Build world data
    world_2011_data = build_world_data(data);
    selected_country_data = get_country_data(world_2011_data, hovered_over_country);

    //DRAW THE INITIAL SUNBURST
    var fuel_data = get_fuel_data(world_2011_data, hovered_over_country);

    init_fuel_radar_data();
    update_fuel_stacked_data("World")
    fuel_radar_cfg = init_fuel_radar_chart(crp_svg_cfg, fuel_stacked_data);
    init_radar_axis(crp_svg, crp_svg_cfg, "fuel_radar", fuel_radar_cfg, 0, 0, fuel_stacked_data)

    //INIT SUNBURST
    init_sunburst_g(crp_svg, fuel_sunburst, fuel_data);

    cp_obj = init_cp_meters(cp_svg);
    cp_meters = init_cp_meters(cp_svg);
    init_country_profile_g( cp_svg);
    init_stacked_emissions_gases(cp_svg);
});