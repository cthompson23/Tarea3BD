USE [Proyecto3-Camila]
GO

CREATE TRIGGER DefaultCCTrigger
ON dbo.Propiedad
FOR INSERT
AS
BEGIN
    BEGIN TRY
        -- Obtener datos de la propiedad recién insertada
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

        -- Agregar Impuesto sobre la propiedad para todos
        INSERT INTO dbo.PropiedadxCC (IdPropiedad, IdCC)
        SELECT @IdPropiedad, C.id
        FROM dbo.ConceptoCobro AS C
        WHERE C.Nombre = 'ImpuestoPropiedad';

        -- Si la zona NO es agrícola
        -- agregar Recolección de basura y limpieza de caños
        IF (@NombreLocalizacion != 'Agrícola')
        BEGIN
            INSERT INTO dbo.PropiedadxCC (IdPropiedad, IdCC)
            SELECT @IdPropiedad, C.id
            FROM dbo.ConceptoCobro AS C
            WHERE C.Nombre = 'RecoleccionBasura';
        END

        --  Si la zona es residencial o comercial agregar Mantenimiento de parques
        IF (@NombreLocalizacion = 'Residencial' OR @NombreLocalizacion = 'Comercial')
        BEGIN
            INSERT INTO dbo.PropiedadxCC (IdPropiedad, IdCC)
            SELECT @IdPropiedad, C.id
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
            ERROR_PROCEDURE(),
            ERROR_MESSAGE(),
            GETDATE()
        );
    END CATCH
END;
GO

