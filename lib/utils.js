/**
 * Validate configuration object for DeviceWatcher.
 * Logs individual errors and returns false if any field is invalid.
 *
 * @param {object} adapter - ioBroker adapter instance (for logging)
 * @param {ioBroker.AdapterConfig} cfg - configuration to check
 * @returns {boolean} true if valid, false if errors found
 */
function validateDeviceConfig(adapter, cfg) {
	let valid = true;

	function err(msg) {
		adapter.log.error(`Config error: ${msg}`);
		valid = false;
	}

	if (!cfg) {
		adapter.log.error('Config object is missing entirely.');
		return false;
	}

	if (!cfg.name || typeof cfg.name !== 'string') {
		err('name is required and must be a string.');
	}

	if (!cfg.powerStateId || typeof cfg.powerStateId !== 'string') {
		err('powerStateId is required and must be a datapoint ID string.');
	}

	if (cfg.switchStateId && typeof cfg.switchStateId !== 'string') {
		err('switchStateId must be a string if provided.');
	}

	const numberChecks = [
		['intervalSeconds', 1, 3600],
		['startThresholdWatt', 0, Infinity],
		['stopThresholdWatt', 0, Infinity],
		['startCounterLimit', 1, Infinity],
		['stopCounterLimit', 1, Infinity],
		['autoOffCounterLimit', 0, Infinity],
		['resetDelayMinutes', 0, 1440],
	];
	numberChecks.forEach(([key, min, max]) => {
		const val = cfg[key];
		if (typeof val !== 'number' || isNaN(val)) {
			err(`${key} must be a number.`);
		} else if (val < min || val > max) {
			err(`${key} must be between ${min} and ${max}.`);
		}
	});

	if (typeof cfg.switchOffAfterFinished !== 'boolean') {
		err('switchOffAfterFinished must be true or false.');
	}

	// Logical check: startThreshold should be > stopThreshold
	if (
		typeof cfg.startThresholdWatt === 'number' &&
		typeof cfg.stopThresholdWatt === 'number' &&
		cfg.startThresholdWatt <= cfg.stopThresholdWatt
	) {
		err('startThresholdWatt should be greater than stopThresholdWatt.');
	}

	return valid;
}

module.exports = validateDeviceConfig;
