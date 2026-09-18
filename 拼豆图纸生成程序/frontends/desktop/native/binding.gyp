{
  "targets": [
    {
      "target_name": "segmentation_addon",
      "sources": ["segmentation_addon.cpp"],
      "include_dirs": ["../../engine/ai_segmentation"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
    }
  ]
}
