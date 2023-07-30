$(document).ready(function () {
	const socket = io();

	let ctx = document.getElementById('myChart').getContext('2d');
	let myChart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: [],
			datasets: [{
				label: "Meat Temperature",
				data: [],
				fill: false,
				pointBackgroundColor: "#FF9600",
				backgroundColor: "#FF9600",
				borderColor: "#FF9600"
			}, {
				label: "Smoker Temperature",
				data: [],
				pointBackgroundColor: "#303030",
				backgroundColor: "#151515CC",
				borderColor: "#151515"
			}]
		},
		options: {
			title: {
				display: false,
				text: $("#sessionName").val()
			},
			scales: {
				yAxes: [{
					ticks: {
						min: 70,
						max: 300
					}
				}],
				xAxes: [{
					time: {
						unit: 'second'
					}
				}]
			}
		}
	});

	let loadChartData = function () {
		console.log("get Chart Data");
		$.getJSON("/session/loadChartData/" + $("#sessionName").val(), function (data) {
			console.log("got Chart Data");
			myChart.data.labels.length = 0;
			myChart.data.datasets[1].data.length = 0;
			myChart.data.datasets[0].data.length = 0;
			data.forEach((item) => {
				myChart.data.labels.push(item.time);
				myChart.data.datasets[1].data.push(item.currBbqTemp);
				myChart.data.datasets[0].data.push(item.currMeatTemp);
			});
			myChart.update();
		});
	};
	loadChartData();

	socket.on('updateTemp', function (data) {
		$("#currBbqTemp").text("Smoker: " + data.currBbqTemp + "°F");
		$("#currMeatTemp").text("Meat: " + data.currMeatTemp + "°F");
		if (data.logState == "on") {
			myChart.data.labels.push(data.time);
			myChart.data.datasets[1].data.push(data.currBbqTemp);
			myChart.data.datasets[0].data.push(data.currMeatTemp);
			myChart.update();
		}

		if (data.isBlowerOn)
			$("#currBbqTemp").css('color', 'red');
		else
			$("#currBbqTemp").css('color', 'green');
	});

});