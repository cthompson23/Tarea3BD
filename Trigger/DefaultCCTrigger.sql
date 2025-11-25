USE [Proyecto3-Camila]
GO

ALTER TRIGGER DefaultCCTrigger
ON dbo.Propiedad
FOR INSERT
AS
BEGIN
    BEGIN TRY
        DECLARE @IdPropiedad INT;
        DECLARE @IdLocalizacion INT;
        DECLARE @NombreLocalizacion NVARCHAR(100);

        SELECT 
            @IdPropiedad = I.id, 
            @IdLocalizacion = I.IdTipoLocalizacion
        FROM INSERTED AS I;

        SELECT @NombreLocalizacion = Nombre 
        FROM dbo.TipoLocalizacion 
        WHERE id = @IdLocalizacion;

        INSERT INTO dbo.PropiedadxCC (IdPropiedad, IdCC, idAsociacion)
        SELECT @IdPropiedad, C.id, 1
        FROM dbo.ConceptoCobro AS C
        WHERE C.Nombre = 'ImpuestoPropiedad';

        -- Consumo de agua
        IF (@NombreLocalizacion IN ('Habitación','Comercial','Industrial'))
        BEGIN
            INSERT INTO dbo.PropiedadxCC (IdPropiedad, IdCC, idAsociacion)
            SELECT @IdPropiedad, C.id, 1
            FROM dbo.ConceptoCobro AS C
            WHERE C.Nombre = 'ConsumoAgua';
        END

        -- Recolección de basura
        IF (@NombreLocalizacion != 'Agrícola')
        BEGIN
            INSERT INTO dbo.PropiedadxCC (IdPropiedad, IdCC, idAsociacion)
            SELECT @IdPropiedad, C.id, 1
            FROM dbo.ConceptoCobro AS C
            WHERE C.Nombre = 'RecoleccionBasura';
        END

        -- Mantenimiento de parques
        IF (@NombreLocalizacion IN ('Habitación','Comercial'))
        BEGIN
            INSERT INTO dbo.PropiedadxCC (IdPropiedad, IdCC, idAsociacion)
            SELECT @IdPropiedad, C.id, 1
            FROM dbo.ConceptoCobro AS C
            WHERE C.Nombre = 'MantenimientoParques';
        END

    END TRY
    BEGIN CATCH
        INSERT INTO dbo.DBError VALUES
        (
            SUSER_NAME(),
            ERROR_NUMBER(),
            ERROR_STATE(),
            ERROR_SEVERITY(),
            ERROR_LINE(),
            'DefaultCCTrigger',
            ERROR_MESSAGE(),
            GETDATE()
        );
    END CATCH
END;
GO
