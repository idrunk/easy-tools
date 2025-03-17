package app

import (
	"os"

	"dario.cat/mergo"
	"github.com/pelletier/go-toml/v2"
)

type AppConfig struct {
	Host  string
	Port  int
	Cors  []string
	Redis RedisConfig
}

type RedisConfig struct {
	Host string
	Port int
	Db 	 int
}

func TomlConfigParse[T any](c *T, confDir string) (err error) {
	if confDir == "" {
		if confDir, err = os.Getwd(); err != nil {
			return
		}
	}
	merged := *c
	var fileLayers []string = []string{confDir + "/app.toml", confDir + "/app.prod.toml", confDir + "/app.dev.toml"}
	for _, f := range fileLayers {
		if _, err = os.Stat(f); err != nil {
			continue
		}
		content, e := os.ReadFile(f)
		if err = e; err != nil {
			return
		}
		var t T
		if err = toml.Unmarshal(content, &t); err != nil {
			return
		}
		if err = mergo.Merge(&merged, t, mergo.WithOverride); err != nil {
			return
		}
	}
	*c = merged
	return nil
}

var Conf *AppConfig

func ConfOrInit() *AppConfig {
	if Conf == nil {
		var conf AppConfig
		if err := TomlConfigParse(&conf, ""); err != nil {
			panic(err.Error())
		}
		Conf = &conf
	}
	return Conf
}

func init() {
	ConfOrInit()
}