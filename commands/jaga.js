const stay = require("./stay");

module.exports = {
    ...stay,
    handleJagaCommand: stay.handleStayCommand,
    handleJagaVoiceStateUpdate: stay.handleStayVoiceStateUpdate,
    startConfiguredJaga: stay.restoreStayConnections,
    stopJaga: stay.stopStay
};
