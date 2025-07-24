import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  let interval: NodeJS.Timeout | undefined;

  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBar.tooltip = 'Click to configure clock or manage Pomodoro timer';
  statusBar.command = 'novaclock.configure';
  statusBar.show();

  const getSettings = () => {
    const config = vscode.workspace.getConfiguration('novaclock');
    const settings = config.get<any>('settings', {});
    return {
      use24HourFormat: settings.use24HourFormat ?? true,
      locale: settings.locale ?? 'default',
      icon: settings.icon ?? '🕒',
      textColor: settings.textColor ?? '#ffffff',
      showSeconds: settings.showSeconds ?? true,
      pomodoroTime: settings.pomodoroTime ?? 25,
      shortBreakTime: settings.shortBreakTime ?? 5,
      longBreakTime: settings.longBreakTime ?? 15,
      autoStartBreak: settings.autoStartBreak ?? false,
    };
  };

  let pomodoroState = {
    isActive: false,
    isBreak: false,
    endTime: 0, // Current period end time
    pomodoroCount: 0,
    pomodoroInterval: undefined as NodeJS.Timeout | undefined,
  };

  const updateClock = () => {
    const { use24HourFormat, locale, icon, textColor, showSeconds } =
      getSettings();

    const now = new Date();
    const clockString = now.toLocaleTimeString(
      locale === 'default' ? undefined : locale,
      {
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        hour12: !use24HourFormat,
      },
    );

    if (!pomodoroState.isActive) {
      statusBar.text = `${clockString} ${icon}`;
    } else {
      const timeLeft = getTimeLeft();
      const pomodoroTimeString = formatTime(timeLeft);
      const pomodoroIcon = pomodoroState.isBreak ? '☕' : '🍅';
      statusBar.text = `${clockString} ${icon} | ${pomodoroTimeString} ${pomodoroIcon}`;
    }
    statusBar.color = textColor;
  };

  const startClock = () => {
    stopClock();
    updateClock();

    const now = new Date();
    const msToNextSecond = 1000 - now.getMilliseconds();

    setTimeout(() => {
      updateClock();
      interval = setInterval(updateClock, 1000);
    }, msToNextSecond);
  };

  const stopClock = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  };

  startClock();

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('novaclock.settings')) {
      startClock();
    }
  });

  const configureClockCommand = vscode.commands.registerCommand(
    'novaclock.configure',
    async () => {
      const config = vscode.workspace.getConfiguration('novaclock');
      const settings = config.get<any>('settings', {});

      const baseOptions = [
        'Toggle 12/24 format',
        'Show/hide seconds',
        'Change locale',
        'Change text color',
        'Change icon',
        'Configure Pomodoro timer',
      ];

      const pomodoroOptions = pomodoroState.isActive
        ? pomodoroState.isBreak
          ? [
              'Resume work',
              'Take short break',
              'Take long break',
              'Stop Pomodoro',
              'Toggle break auto-start',
            ]
          : [
              'Take short break',
              'Take long break',
              'Stop Pomodoro',
              'Toggle break auto-start',
            ]
        : ['Start Pomodoro', 'Toggle break auto-start'];

      const choice = await vscode.window.showQuickPick(
        [...baseOptions, ...pomodoroOptions],
        { placeHolder: 'Select what to change' },
      );

      if (!choice) return;

      switch (choice) {
        case 'Toggle 12/24 format': {
          await config.update(
            'settings',
            {
              ...settings,
              use24HourFormat: !settings.use24HourFormat,
            },
            vscode.ConfigurationTarget.Global,
          );
          break;
        }
        case 'Show/hide seconds': {
          await config.update(
            'settings',
            {
              ...settings,
              showSeconds: !settings.showSeconds,
            },
            vscode.ConfigurationTarget.Global,
          );
          break;
        }
        case 'Change locale': {
          const input = await vscode.window.showInputBox({
            prompt: 'Enter locale (e.g., en-US, ru-RU)',
            placeHolder: 'default',
          });
          if (input !== undefined) {
            await config.update(
              'settings',
              {
                ...settings,
                locale: input.trim() || 'default',
              },
              vscode.ConfigurationTarget.Global,
            );
          }
          break;
        }
        case 'Change text color': {
          const input = await vscode.window.showInputBox({
            prompt: 'Enter HEX color (e.g., #ffffff)',
            placeHolder: '#ffffff',
          });
          if (input) {
            await config.update(
              'settings',
              {
                ...settings,
                textColor: input,
              },
              vscode.ConfigurationTarget.Global,
            );
          }
          break;
        }
        case 'Change icon': {
          const input = await vscode.window.showInputBox({
            prompt: 'Enter emoji (e.g., 🕘, ⏰, ⌚)',
            placeHolder: '🕒',
          });
          if (input) {
            await config.update(
              'settings',
              {
                ...settings,
                icon: input,
              },
              vscode.ConfigurationTarget.Global,
            );
          }
          break;
        }
        case 'Configure Pomodoro timer': {
          const pomodoroTime = await vscode.window.showInputBox({
            prompt: 'Enter Pomodoro duration in minutes',
            placeHolder: '25',
          });
          const shortBreakTime = await vscode.window.showInputBox({
            prompt: 'Enter short break duration in minutes',
            placeHolder: '5',
          });
          const longBreakTime = await vscode.window.showInputBox({
            prompt: 'Enter long break duration in minutes',
            placeHolder: '15',
          });

          if (pomodoroTime && shortBreakTime && longBreakTime) {
            await config.update(
              'settings',
              {
                ...settings,
                pomodoroTime: parseInt(pomodoroTime),
                shortBreakTime: parseInt(shortBreakTime),
                longBreakTime: parseInt(longBreakTime),
              },
              vscode.ConfigurationTarget.Global,
            );
          }
          break;
        }
        case 'Start Pomodoro': {
          const shouldStart = await vscode.window.showInformationMessage(
            'Ready to start working?',
            'Yes, start timer',
            'No, cancel',
          );
          if (shouldStart === 'Yes, start timer') {
            startPomodoro();
          }
          break;
        }
        case 'Resume work': {
          const shouldResume = await vscode.window.showInformationMessage(
            'Ready to get back to work?',
            'Yes, start working',
            'No, continue break',
          );
          if (shouldResume === 'Yes, start working') {
            startPomodoro();
          }
          break;
        }
        case 'Take short break': {
          startBreak(false);
          break;
        }
        case 'Take long break': {
          startBreak(true);
          break;
        }
        case 'Stop Pomodoro': {
          stopPomodoro();
          break;
        }
        case 'Toggle break auto-start': {
          await config.update(
            'settings',
            {
              ...settings,
              autoStartBreak: !settings.autoStartBreak,
            },
            vscode.ConfigurationTarget.Global,
          );
          const newAutoStartBreak = !settings.autoStartBreak;
          vscode.window.showInformationMessage(
            newAutoStartBreak
              ? 'Break auto-start enabled'
              : 'Break auto-start disabled',
          );
          break;
        }
      }
    },
  );

  const startPomodoro = () => {
    const settings = getSettings();
    pomodoroState.isActive = true;
    pomodoroState.isBreak = false;

    // Set the end time
    const now = new Date();
    pomodoroState.endTime = now.getTime() + settings.pomodoroTime * 60 * 1000;

    startTimer();
  };

  const startBreak = (isLong: boolean) => {
    const settings = getSettings();
    pomodoroState.isActive = true;
    pomodoroState.isBreak = true;

    // Set the break end time
    const now = new Date();
    const breakDuration =
      (isLong ? settings.longBreakTime : settings.shortBreakTime) * 60 * 1000;
    pomodoroState.endTime = now.getTime() + breakDuration;

    startTimer();
  };

  const stopPomodoro = () => {
    if (pomodoroState.pomodoroInterval) {
      clearInterval(pomodoroState.pomodoroInterval);
      pomodoroState.pomodoroInterval = undefined;
    }
    pomodoroState.isActive = false;
    pomodoroState.endTime = 0;
    pomodoroState.pomodoroCount = 0;
    updatePomodoroDisplay();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeLeft = () => {
    if (!pomodoroState.isActive) return 0;
    const now = new Date().getTime();
    const timeLeft = Math.max(
      0,
      Math.ceil((pomodoroState.endTime - now) / 1000),
    );
    return timeLeft;
  };

  const updatePomodoroDisplay = () => {
    updateClock();
  };

  const startTimer = () => {
    const now = new Date();
    const msToNextSecond = 1000 - now.getMilliseconds();

    // First clear the previous interval if it exists
    if (pomodoroState.pomodoroInterval) {
      clearInterval(pomodoroState.pomodoroInterval);
      pomodoroState.pomodoroInterval = undefined;
    }

    updatePomodoroDisplay();

    // Synchronize with the start of the next second
    setTimeout(() => {
      updatePomodoroDisplay();
      pomodoroState.pomodoroInterval = setInterval(async () => {
        const currentTime = new Date().getTime();

        if (currentTime >= pomodoroState.endTime) {
          const settings = getSettings(); // Get current settings
          pomodoroState.pomodoroCount++;
          const isLongBreak = pomodoroState.pomodoroCount % 4 === 0;

          if (pomodoroState.isBreak) {
            // Stop the timer and wait for user confirmation
            if (pomodoroState.pomodoroInterval) {
              clearInterval(pomodoroState.pomodoroInterval);
              pomodoroState.pomodoroInterval = undefined;
            }
            const shouldStartWork = await vscode.window.showInformationMessage(
              'Break time is over! Ready to start working?',
              'Yes, start working',
              'Need more time',
            );
            if (shouldStartWork === 'Yes, start working') {
              startPomodoro();
            } else {
              // Show break selection dialog if user needs more time
              const settings = getSettings();
              const message = `Choose break duration (short: ${settings.shortBreakTime}min, long: ${settings.longBreakTime}min):`;
              const shortBreakOption = 'Short break';
              const longBreakOption = 'Long break';
              const stopOption = 'Stop timer';

              vscode.window
                .showInformationMessage(
                  message,
                  shortBreakOption,
                  longBreakOption,
                  stopOption,
                )
                .then((choice) => {
                  switch (choice) {
                    case shortBreakOption:
                      startBreak(false);
                      break;
                    case longBreakOption:
                      startBreak(true);
                      break;
                    default:
                      stopPomodoro();
                      vscode.window.showInformationMessage(
                        'Pomodoro timer stopped',
                      );
                  }
                });
            }
          } else {
            // Get the most up-to-date settings
            const currentSettings = getSettings();
            if (currentSettings.autoStartBreak) {
              startBreak(isLongBreak);
              vscode.window.showInformationMessage(
                'Great work! Time for a break!',
              );
            } else {
              // Stop the timer while waiting for user response
              if (pomodoroState.pomodoroInterval) {
                clearInterval(pomodoroState.pomodoroInterval);
                pomodoroState.pomodoroInterval = undefined;
              }

              const settings = getSettings();
              const message = isLongBreak
                ? `Well done! A long break (${settings.longBreakTime}min) is recommended:`
                : `Well done! A short break (${settings.shortBreakTime}min) is recommended:`;
              const shortBreakOption = 'Short break';
              const longBreakOption = 'Long break';
              const stopOption = 'Stop timer';

              vscode.window
                .showInformationMessage(
                  message,
                  shortBreakOption,
                  longBreakOption,
                  stopOption,
                )
                .then((choice) => {
                  switch (choice) {
                    case shortBreakOption:
                      startBreak(false);
                      break;
                    case longBreakOption:
                      startBreak(true);
                      break;
                    default:
                      stopPomodoro();
                      vscode.window.showInformationMessage(
                        'Pomodoro timer stopped',
                      );
                  }
                });
            }
          }
        }
        updatePomodoroDisplay();
      }, 1000);
    }, msToNextSecond);
  };

  context.subscriptions.push(statusBar, configureClockCommand, {
    dispose: stopClock,
  });
}

export function deactivate() {}
