
importScripts('../librarys/RGraph.common.core.js');
importScripts('../librarys/RGraph.common.csv.js');
importScripts('../librarys/dataStream.js');
importScripts('./webSockets.js');

self.addEventListener('message', function(e)
{
    var data = e.data.split('<>');
    db_server = data[0];
    db_name = data[1];
    db_group = data[2];
    window = data[3];
    level = data[4];
    tableColumns = data[5];
    tableName = data[6];
    maxLevel = data[7];
    db_items = data[8];
    labels = data[9];
    dataLevels = data[10];
    startBackgroundCaching();
});

db = openDatabase('DB', '1.0', '', 50 * 1024 * 1024);
socket = webSockets('ws://localhost:12345');


startBackgroundCaching = function()
{
    channelCount = tableColumns.split(',').length - 1;
    socket.openSocket();
    socket.setOnOpenCallback(function()
    {
        socket.setOnMessageCallback(onMessageRecieved);
        socket.sendMessage(tableName + '<>' + window + '<>' + '1' + '<>' + 'mean');
    });


};




function onReadyFormingData(objData)
{
    db.transaction(function(req)
    {
        //var objData = parseData(csv);
        if (objData.dateTime.length != 0)
        {
            if (objData.data[0].length < 20000)
            {
                var idDataSource;
                req.executeSql('SELECT id FROM DataSource WHERE db_server = "' + db_server + '" AND \n\
                                                   db_name = "' + db_name + '" AND \n\
                                                   db_group = "' + db_group + '" AND \n\
                                                   level = "' + level + '"', [], function(req, results)
                {
                    if (results.rows.length != 0)
                    {
                        idDataSource = results.rows.item(0).id;
                        req.executeSql('CREATE TABLE IF NOT EXISTS "' + idDataSource + '" (DateTime NOT NULL UNIQUE' + tableColumns + ')');
                        req.executeSql('CREATE INDEX IF NOT EXISTS DateTimeIndex ON "' + idDataSource + '" (DateTime)');
                        for (var p = 0; p < objData.dateTime.length; p++)
                        {
                            req.executeSql('INSERT OR REPLACE INTO "' + idDataSource + '" (DateTime ' + tableColumns + ') ' + 'VALUES ' + '("' + objData.dateTime[p] + '"' + formValues(objData.data, p) + ')');
                        }
                    }
                    else
                    {
                        req.executeSql('INSERT OR REPLACE INTO DataSource (db_server, db_name, db_group, level, db_items, maxlevel, labels, datalevels) VALUES ("' + db_server + '","' + db_name + '","' + db_group + '","' + level + '","' + db_items + '","' + maxLevel + '","' + labels + '","' + dataLevels + '")');
                        req.executeSql('SELECT id FROM DataSource WHERE db_server = "' + db_server + '" AND \n\
                                                   db_name = "' + db_name + '" AND \n\
                                                   db_group = "' + db_group + '" AND \n\
                                                   level = "' + level + '"', [], function(req, results)
                        {
                            idDataSource = results.rows.item(0).id;
                            req.executeSql('CREATE TABLE IF NOT EXISTS "' + idDataSource + '" (DateTime NOT NULL UNIQUE' + tableColumns + ')');
                            req.executeSql('CREATE INDEX IF NOT EXISTS DateTimeIndex ON "' + idDataSource + '" (DateTime)');
                            for (var p = 0; p < objData.dateTime.length; p++)
                            {
                                req.executeSql('INSERT OR REPLACE INTO "' + idDataSource + '" (DateTime ' + tableColumns + ') ' + 'VALUES ' + '("' + objData.dateTime[p] + '"' + formValues(objData.data, p) + ')');
                            }
                        });
                    }
                });

            }
            else
            {
                self.close();

            }
        }
        else
        {
            self.close();
        }
    },
            onError,
            onReadyTransaction);
}





function onReadyWork()
{
    //self.close();
}
;

function onErrorWork(err)
{
    console.log("err");
    self.close();
}

function onReadyTransaction()
{
    //self.close();
}
;

function onError(err)
{
    console.log("err");

    self.close();
}
;

function onMessageRecieved(msg)
{
    var dataStream = new DataStream(msg.data);
    dataStream.endianness = dataStream.BIG_ENDIAN;

    //var dataCount = dataStream.readInt16(true);
    var dateTime = [];
    var data = [];
    for (var i = 0; i < channelCount; i++)
    {
        data.push([]);
    }

    while (!dataStream.isEof())
    {
        //dataStream.readCString(26);
        dateTime.push(dataStream.readCString(26));
        for (var i = 0; i < channelCount; i++)
        {
            data[i].push(dataStream.readFloat32(true));
        }
    }

    onReadyFormingData({data: data, dateTime: dateTime});
}
;

function formValues(data, i)
{
    var values = '';
    for (var j = 0; j < data.length; j++)
    {
        values = values + ',' + data[j][i];
    }
    return values;
}
;



//У меня есть ежедневник, в котором все детально описано, планирование наше все:)
//Эта проблема со всеми браузерами.
//
//Теперь самое интересное, начну с того, что расскажу сколько времени занимает HTTP GET. Прошу 2500 точек у локального сервера, это тоже надо учитывать:
//1) Время ожидания ответа от сервера 205-215 ms с ресэмплингом
//2) Время парсинга CSV 20-25 ms
//Воткнул в php передачу бинарных данных, и те же самые условия, резултат:
//1) Время ожидания ответа от сервера 100-105 ms без ресэмплинга
//2) Время парсинга байтовых данных 1-2 ms (я опешил :D)
//Теперь подведу небольшие итоги:
//1) Кэширование через HTTP GET - не оптимизировал еще, там однозначно нужна оптимизация, так как я делаю дополнительные запросы на сервер:
//1.1) О максимальном разрешении данных
//1.2) Формировании маски
//1.3) Так же форматирование пересылаемого времени достаточно долго(еще пока не знаю почему)
//Результат: 95 процентов работы функций это время на http get(и это без запроса данных).
//2) Кэширование через websockets binary data - тоже не оптимизировал еще, с ним такие же проблемы только чуть больше:
//2.1) Прошу максимальное разрешение данных
//2.2) Прошу Маску и Имена каналов(так сервер в этом случае присылает только данные)
//2.3) Прошу имя таблицы у сервера, для нужного уровня данных, для передачи серверу на вебсокетах(эта штука нужна будет постоянно, а время ответа 30 - 40 ms, теперь начинаю сомневаться на счет сервера на C)
//2.4) Прошу кэш конфиг(так как ты сказал, что мои уровни данных должны отражать кэш базы данных, поэтому я не хардкорю все это дело как в прошлый раз, а динамически задаю уровни данных для каждого источника)
//Как результат, тоже самое что и выше. Скорее всего эти данные буду кэшировать, чтобы их можно было быстро достать, но просить имя таблицы придется каждый раз.
//
//Подведу небольшой итог: websockets на бинарных данных на первый взгляд лучше, посмотрим что дальше покажет. Да заметил такую очень интересную вещь, скорость ответа от сервера практически не влияет на работу модуля кэширования данных, она влият только при первом запросе - когда в модуле нету ни капли данных, все остальное вообще никак незаметно, просто второй поток чуть медленее будет кэшировать данные, на интерфейсе и на скорости это не отражается никак. Поэтому встает вопрос, стоит ли ради небольшого выйгрыша во времени с самого начала, использовать сервер на С, когда я это "выйгрышное" время буду тратить на получение названия таблицы мускула? Уже сомневаюсь больше.
//