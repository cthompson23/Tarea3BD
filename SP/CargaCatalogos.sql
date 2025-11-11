USE Tarea3 
GO

CREATE PROCEDURE SP_CargarCatalogos (
  @inXMLData NVARCHAR(MAX),
  @outResultCode INT OUTPUT
)

AS
BEGIN 
	BEGIN TRY
		SET @outResultCode = 0; 

        DECLARE @xml XML
        SET @xml = CAST(@inXMLData AS XML);
		
        -- Tablas temporales
		DECLARE @tempTipoMovimiento TABLE (Sec INT IDENTITY(1,1), TipoMov XML);
        DECLARE @tempTipoUso TABLE (Sec INT IDENTITY(1,1), TipoUso XML);
        DECLARE @tempTipoLocalizacion TABLE (Sec INT IDENTITY(1,1), TipoLoc XML);
        DECLARE @tempTipoUsuario TABLE (Sec INT IDENTITY(1,1), TipoUser XML);
        DECLARE @tempPeriodoMonto TABLE (Sec INT IDENTITY(1,1), Periodo XML);
        DECLARE @tempCC TABLE (Sec INT IDENTITY(1,1), CC XML);

        -- Insertar nodos en tablas temporales
        INSERT INTO @tempTipoMovimiento(TipoMov)
        SELECT X.query('.') FROM @xml.nodes('/Catalogos/TipoMovimientoLecturaMedidor/TipoMov') AS T(X);

        INSERT INTO @tempTipoUso(TipoUso)
        SELECT X.query('.') FROM @xml.nodes('/Catalogos/TipoUsoPropiedad/TipoUso') AS T(X);

        INSERT INTO @tempTipoLocalizacion(TipoLoc)
        SELECT X.query('.') FROM @xml.nodes('/Catalogos/TipoZonaPropiedad/TipoZona') AS T(X);

        INSERT INTO @tempTipoUsuario(TipoUser)
        SELECT X.query('.') FROM @xml.nodes('/Catalogos/TipoUsuario/TipoUser') AS T(X);

        INSERT INTO @tempPeriodoMonto(Periodo)
        SELECT X.query('.') FROM @xml.nodes('/Catalogos/PeriodoMontoCC/PeriodoMonto') AS T(X);

        INSERT INTO @tempCC(CC)
        SELECT X.query('.') FROM @xml.nodes('/Catalogos/CCs/CC') AS T(X);

        DECLARE @hi1 INT, @hi2 INT, @hi3 INT, @hi4 INT, @hi5 INT, @hi6 INT;

        SELECT @hi1 = MAX(Sec) FROM @tempTipoMovimiento;
        SELECT @hi2 = MAX(Sec) FROM @tempTipoUso;
        SELECT @hi3 = MAX(Sec) FROM @tempTipoLocalizacion;
        SELECT @hi4 = MAX(Sec) FROM @tempTipoUsuario;
        SELECT @hi5 = MAX(Sec) FROM @tempPeriodoMonto;
        SELECT @hi6 = MAX(Sec) FROM @tempCC;

        DECLARE @lo1 INT = 1
                , @lo2 INT = 1
                , @lo3 INT = 1
                , @lo4 INT = 1
                , @lo5 INT = 1
                , @lo6 INT = 1;

        BEGIN TRANSACTION InsertarDatosMunicipales;

        -- TipoMovimiento
        WHILE (@lo1 <= @hi1)
        BEGIN
            INSERT INTO dbo.TipoMovimiento (id, Nombre)
            SELECT 
                T.TipoMov.value('(/TipoMov/@id)[1]', 'INT'),
                T.TipoMov.value('(/TipoMov/@nombre)[1]', 'VARCHAR(80)')
            FROM @tempTipoMovimiento T WHERE T.Sec = @lo1;

            SET @lo1 += 1;
        END;

        -- TipoUso
        WHILE (@lo2 <= @hi2)
        BEGIN
            INSERT INTO dbo.TipoUso (id, Nombre)
            SELECT 
                T.TipoUso.value('(/TipoUso/@id)[1]', 'INT'),
                T.TipoUso.value('(/TipoUso/@nombre)[1]', 'VARCHAR(80)')
            FROM @tempTipoUso T WHERE T.Sec = @lo2;

            SET @lo2 += 1;
        END;

        -- TipoZona -> TipoLocalizacion
        WHILE (@lo3 <= @hi3)
        BEGIN
            INSERT INTO dbo.TipoLocalizacion (id, Nombre)
            SELECT 
                T.TipoLoc.value('(/TipoZona/@id)[1]', 'INT'),
                T.TipoLoc.value('(/TipoZona/@nombre)[1]', 'VARCHAR(80)')
            FROM @tempTipoLocalizacion T WHERE T.Sec = @lo3;

            SET @lo3 += 1;
        END;

        -- TipoUsuario
        WHILE (@lo4 <= @hi4)
        BEGIN
            INSERT INTO dbo.TipoUsuario (id, Nombre)
            SELECT 
                T.TipoUser.value('(/TipoUser/@id)[1]', 'INT'),
                T.TipoUser.value('(/TipoUser/@nombre)[1]', 'VARCHAR(80)')
            FROM @tempTipoUsuario T WHERE T.Sec = @lo4;

            SET @lo4 += 1;
        END;

        -- PeriodoMontoCC -> PeriodoCobroCC
        WHILE (@lo5 <= @hi5)
        BEGIN
            INSERT INTO dbo.PeriodoCobroCC (id, Nombre, QDividir, Dias)
            SELECT 
                T.Periodo.value('(/PeriodoMonto/@id)[1]', 'INT'),
                T.Periodo.value('(/PeriodoMonto/@nombre)[1]', 'VARCHAR(80)'),
                T.Periodo.value('(/PeriodoMonto/@qMeses)[1]', 'INT'),
                T.Periodo.value('(/PeriodoMonto/@dias)[1]', 'INT')
            FROM @tempPeriodoMonto T WHERE T.Sec = @lo5;

            SET @lo5 += 1;
        END;

        -- ConceptoCobro
        DECLARE @idCC INT, @nombreCC VARCHAR(100);

        WHILE (@lo6 <= @hi6)
        BEGIN
            SELECT 
                @idCC = T.CC.value('(/CC/@id)[1]', 'INT'),
                @nombreCC = T.CC.value('(/CC/@nombre)[1]', 'VARCHAR(100)')
            FROM @tempCC T WHERE T.Sec = @lo6;

            -- Insert en ConceptoCobro
            INSERT INTO dbo.ConceptoCobro (id, Nombre, IdPeriodo)
            SELECT 
                T.CC.value('(/CC/@id)[1]', 'INT'),
                T.CC.value('(/CC/@nombre)[1]', 'VARCHAR(100)'),
                T.CC.value('(/CC/@PeriodoMontoCC)[1]', 'INT')
            FROM @tempCC T WHERE T.Sec = @lo6;

            -- Inserción en tabla específica según nombre
            IF @nombreCC = 'ConsumoAgua'
                INSERT INTO dbo.CC_Agua (id, ValorMinimo, TarifaMinimaPorM3)
                SELECT 
                    T.CC.value('(/CC/@id)[1]', 'INT'),
                    T.CC.value('(/CC/@ValorMinimo)[1]', 'DECIMAL(10,2)'),
                    T.CC.value('(/CC/@ValorMinimoM3)[1]', 'DECIMAL(10,2)')
                FROM @tempCC T WHERE T.Sec = @lo6;

            ELSE IF @nombreCC = 'ImpuestoPropiedad'
                INSERT INTO dbo.CC_ImpuestoPropiedad (id, PorcentajeAnual)
                SELECT 
                    T.CC.value('(/CC/@id)[1]', 'INT'),
                    T.CC.value('(/CC/@ValorPorcentual)[1]', 'DECIMAL(10,4)')
                FROM @tempCC T WHERE T.Sec = @lo6;

            ELSE IF @nombreCC = 'RecoleccionBasura'
                INSERT INTO dbo.CC_RecoleccionBasura (id, ValorMinimo, ValorM2Base, ValorTramoM2)
                SELECT 
                    T.CC.value('(/CC/@id)[1]', 'INT'),
                    T.CC.value('(/CC/@ValorMinimo)[1]', 'DECIMAL(10,2)'),
                    T.CC.value('(/CC/@ValorM2Minimo)[1]', 'DECIMAL(10,2)'),
                    T.CC.value('(/CC/@ValorTramosM2)[1]', 'DECIMAL(10,2)')
                FROM @tempCC T WHERE T.Sec = @lo6;

            ELSE IF @nombreCC = 'PatenteComercial'
                INSERT INTO dbo.CC_PatenteComercial (id, MontoSemestral)
                SELECT 
                    T.CC.value('(/CC/@id)[1]', 'INT'),
                    T.CC.value('(/CC/@ValorFijo)[1]', 'DECIMAL(10,2)')
                FROM @tempCC T WHERE T.Sec = @lo6;

            ELSE IF @nombreCC = 'MantenimientoParques'
                INSERT INTO dbo.CC_MantenimientoParques (id, ValorAnual)
                SELECT 
                    T.CC.value('(/CC/@id)[1]', 'INT'),
                    T.CC.value('(/CC/@ValorFijo)[1]', 'DECIMAL(10,2)')
                FROM @tempCC T WHERE T.Sec = @lo6;

            ELSE IF @nombreCC = 'ReconexionAgua'
                INSERT INTO dbo.CC_ReconexionAgua (id, MontoFijo)
                SELECT 
                    T.CC.value('(/CC/@id)[1]', 'INT'),
                    T.CC.value('(/CC/@ValorFijo)[1]', 'DECIMAL(10,2)')
                FROM @tempCC T WHERE T.Sec = @lo6;

            ELSE IF @nombreCC = 'InteresesMoratorios'
                INSERT INTO dbo.CC_InteresesMoratorios (id, PorcentajeMensual)
                SELECT 
                    T.CC.value('(/CC/@id)[1]', 'INT'),
                    T.CC.value('(/CC/@ValorPorcentual)[1]', 'DECIMAL(10,4)')
                FROM @tempCC T WHERE T.Sec = @lo6;

            SET @lo6 += 1;
        END;

        COMMIT TRANSACTION InsertarDatosMunicipales;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION InsertarDatosMunicipales;

        INSERT INTO dbo.DBError VALUES
        (
            SUSER_NAME(),
            ERROR_NUMBER(),
            ERROR_STATE(),
            ERROR_SEVERITY(),
            ERROR_LINE(),
            ERROR_PROCEDURE(),
            ERROR_MESSAGE(),
            GETDATE()
        );
        PRINT 'Error capturado: ' + ERROR_MESSAGE();

        SET @outResultCode = 50008;
    END CATCH
END;
GO

select * from PeriodoCobroCC