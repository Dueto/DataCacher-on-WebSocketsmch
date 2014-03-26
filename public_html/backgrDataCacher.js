              
        importScripts('RGraph.common.core.js');  
        importScripts('RGraph.common.csv.js');  
              
        self.addEventListener('message', function(e)
        {
            var data = e.data.split('<>');   
            startBackgroundCaching(data[0], data[1], data[2], data[3], data[4], data[5]);  
        });
        
        startBackgroundCaching = function (db_server,
                                           db_name,
                                           db_group,                                           
                                           window,
                                           level,
                                           tableColumns)
       {  
          var db = openDatabase('DB', '1.0', '', 50*1024*1024);               
          db.transaction(function(req)
          {
                var url = formURL(db_server, db_name, db_group, window, level);                
                var csv = new RGraph.CSV(url, function(csv)
                {                                   
                      var objData = parseData(csv);
                      if (objData.label != undefined) 
                      {       
                          if(objData.data[0].length < 100000)
                          {                                       
                             db.transaction(function(req)
                             {
                                 console.log(url);
                                 var idDataSource;
                                 //req.executeSql('INSERT OR REPLACE INTO DataSource (db_server, db_name, db_group, level ) VALUES ("' + db_server + '","' + db_name + '","' + db_group + '","' + level + '")');    
                                 req.executeSql('SELECT id FROM DataSource WHERE db_server = "' + db_server + '" AND \n\
                                                           db_name = "' + db_name + '" AND \n\
                                                           db_group = "' + db_group + '" AND \n\
                                                           level = "' + level + '"', [], function (req, results)
                                 {         
                                     if(results.rows.length != 0)
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
                                         req.executeSql('INSERT OR REPLACE INTO DataSource (db_server, db_name, db_group, level ) VALUES ("' + db_server + '","' + db_name + '","' + db_group + '","' + level + '")');                                             
                                         req.executeSql('SELECT id FROM DataSource WHERE db_server = "' + db_server + '" AND \n\
                                                           db_name = "' + db_name + '" AND \n\
                                                           db_group = "' + db_group + '" AND \n\
                                                           level = "' + level + '"', [], function (req, results)
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
                             });
                          }
                          else
                          {
                            
                          }
                      }
                      else
                      {   
                          
                      } 
                  });    
          },
          onError,
          onReadyTransaction);
        };
        
        function onReadyTransaction()
        {                
            console.log('Transaction completed.');
            //self.close();
	};
 
        function onError(err)
        {
            console.log(err.message);
            //self.close();
	};
        
        function parseData(csv)
        {
            var numrows = csv.numrows;            
            var numcols = csv.numcols;            
            var labels = csv.getRow(0,1);   
            var allData = new Array(numcols);

            for (i = 0; i < numcols; i++) 
            {
                allData[i] = new Array(numrows -1);
                var row = csv.getCol(i,1);

                for (j = 0; j < numrows - 1; j++) 
                {           
                    if (i === 0) 
                    {      
                        //var Milliseconds = row[j].substr(22);
                        allData[i][j] = splitTimeFromAny(row[j]);
                    }
                    else
                    {
                        allData[i][j] = parseFloat(row[j]);
                    }

                }
            }
            var data = [];
            for(var i = 1; i < allData.length; i++)
            {
                data.push(allData[i]);
            }
            
            return {data: data, dateTime: allData[0], label: labels};
        };
        
        function formURL(db_server, db_name, db_group, window, level)
        {
            var url = 'http://localhost/ADEI/ADEIWS/services/getdata.php?db_server=' + db_server 
                    + '&db_name=' + db_name
                    + '&db_group=' + db_group 
                    + '&db_mask=all' 
                    + '&experiment=' + window 
                    + '&window=0' 
                    + '&resample=' + level 
                    + '&format=csv';                        
            return url; 
        };
        
        function splitTimeFromAny(window)
        {       
                var Microsec = window.substr(19);
                var d = new Date(window);
                var buf = d.toISOString().substr(13).substring(0,7);                
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                var Time = d.toISOString().substring(0,13);                
                Time = Time + buf + Microsec;
                return Time;
        };
        
        function formValues(data, i)
        {
            var values = '';
            for(var j = 0; j < data.length; j++)
            {
                values = values + ',' + data[j][i];
            }
            return values;
        };

   

