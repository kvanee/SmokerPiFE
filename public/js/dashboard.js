$(document).ready(function () {
	const socket = io();

	let disconnectTimer = null;

	function showConnected() {
		if (disconnectTimer) {
			clearTimeout(disconnectTimer);
			disconnectTimer = null;
		}
		$('#connectionStatus').addClass('connected').removeClass('disconnected');
		$('#connectionStatusText').text('Connected');
	}

	// Debounce the "disconnected" state: Socket.IO reconnects automatically, so a
	// brief blip shouldn't flap the indicator. Only show red if we stay down.
	function showDisconnected() {
		if (disconnectTimer) {
			return;
		}
		disconnectTimer = setTimeout(function () {
			disconnectTimer = null;
			$('#connectionStatus').addClass('disconnected').removeClass('connected');
			$('#connectionStatusText').text('Disconnected');
		}, 2000);
	}

	socket.on('connect', showConnected);
	socket.on('disconnect', showDisconnected);
	socket.on('connect_error', showDisconnected);

	$('input[name=setBlowerState]:checked').parent().addClass('active');
	$('input[name=setLogState]:checked').parent().addClass('active');
	$('#done').click(function () {
		socket.emit('setSessionDone');
	})

	socket.on('setSessionName', function (data) {
		window.location.replace('/session/dashboard');
	});
	$('input[type=radio][name=setBlowerState]').change(function () {
		socket.emit('setBlowerState', {
			password: $('#password').val(),
			blowerState: this.value
		});
	});
	socket.on('setBlowerState', function (data) {
		$('input[type=radio][name=setBlowerState][value="' + data + '"]').prop("checked", true);
		$('input[name=setBlowerState]').parent().removeClass('active');
		$('input[name=setBlowerState]:checked').parent().addClass('active');
	});
	$('input[type=radio][name=setLogState]').change(function () {
		socket.emit('setLogState', {
			password: $('#password').val(),
			logState: this.value
		});
	});
	socket.on('setLogState', function (data) {
		$('input[type=radio][name=setLogState][value="' + data + '"]').prop("checked", true);
		$('input[name=setLogState]').parent().removeClass('active');
		$('input[name=setLogState]:checked').parent().addClass('active');
	});
	$('#saveSettings').click(function () {
		socket.emit('saveSettings', {
			period: $('#period').val(),
			targetTemp: $('#targetTemp').val(),
			alertHigh: $('#alertHigh').val(),
			alertLow: $('#alertLow').val(),
			alertMeat: $('#alertMeat').val()
		});
	});
	$('#cancelSettings').click(function () {
		socket.emit('getSettings');
	});
	socket.on('updateSettings', function (data) {
		$('#period').val(data.period);
		$('#targetTemp').val(data.targetTemp);
		$('#alertHigh').val(data.alertHigh);
		$('#alertLow').val(data.alertLow);
		$('#alertMeat').val(data.alertMeat)
	});
	socket.on('sessionDone', function () {
		window.location.replace('/session/complete');
	});
	socket.on('updateFailed', function (data) {
		$("#updateError").html('<div class="alert alert-danger" role="alert">' + data + '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>')
	});
});