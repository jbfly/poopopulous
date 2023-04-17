using System.IO;

using UnityEngine;

[UnityEditor.AssetImporters.ScriptedImporter(1, "ass")]
public class AssImporter : UnityEditor.AssetImporters.ScriptedImporter
{
    public override void OnImportAsset(UnityEditor.AssetImporters.AssetImportContext ctx)
    {
        string fileContent = File.ReadAllText(ctx.assetPath);

        TextAsset textAsset = new TextAsset(fileContent);
        ctx.AddObjectToAsset("main", textAsset);
        ctx.SetMainObject(textAsset);
    }
}