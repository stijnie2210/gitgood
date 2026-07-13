package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	appMenu := menu.NewMenu()
	gitgoodMenu := appMenu.AddSubmenu("gitgood")
	gitgoodMenu.AddText("Preferences…", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		if app.ctx != nil {
			runtime.EventsEmit(app.ctx, "open-preferences")
		}
	})
	gitgoodMenu.AddSeparator()
	gitgoodMenu.AddText("Quit gitgood", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		if app.ctx != nil {
			runtime.Quit(app.ctx)
		}
	})

	appMenu.Append(menu.EditMenu())

	err := wails.Run(&options.App{
		Title:  "gitgood",
		Width:  1440,
		Height: 900,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		Menu:             appMenu,
		OnStartup:        app.startup,
		OnBeforeClose:    app.beforeClose,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
