// 0x597a30 SED_Load size=307

char __thiscall sub_597A30(int this, char *Source)
{
  wchar_t *v3; // eax
  int v4; // eax
  int v5; // ecx
  int v6; // eax
  int v7; // eax
  int v8; // ecx
  int v9; // eax
  int v10; // eax
  int v11; // ecx
  int v12; // eax
  int v13; // eax
  int v14; // ecx
  int v15; // eax
  int v16; // eax
  int v17; // ecx
  int v18; // eax
  int v20; // [esp-4h] [ebp-BCh]
  int v21; // [esp-4h] [ebp-BCh]
  int v22; // [esp-4h] [ebp-BCh]
  int v23; // [esp-4h] [ebp-BCh]
  int v24; // [esp-4h] [ebp-BCh]
  _DWORD v25[7]; // [esp+Ch] [ebp-ACh] BYREF
  _DWORD v26[6]; // [esp+28h] [ebp-90h] BYREF
  char v27; // [esp+40h] [ebp-78h]
  int v28; // [esp+44h] [ebp-74h]
  int v29; // [esp+48h] [ebp-70h]
  _DWORD v30[22]; // [esp+4Ch] [ebp-6Ch] BYREF
  _BYTE v31[12]; // [esp+A4h] [ebp-14h] BYREF
  int v32; // [esp+B0h] [ebp-8h]

  if ( Source != nullptr )
  {
    nullsub_1("Loading random map: %s\n", Source);
    sub_4739F0(Source);
    v25[4] = &GenericNode::`vftable';
    v26[0] = &GenericNode::`vftable';
    v25[1] = 0;
    v25[2] = 0;
    v25[5] = 0;
    v25[6] = 0;
    v26[1] = 0;
    v26[2] = 0;
    sub_40E340(v26);
    v25[3] = &List<INIClass::INISection *>::`vftable';
    memset(&v26[3], 0, 12);
    v27 = 0;
    v28 = 0;
    v29 = 0;
    v25[0] = &INIClass::`vftable';
    if ( sub_525A10(v30, 0) != 0 )
    {
      v3 = (wchar_t *)sub_734E60(aTxtRandomMapDe, (int)aDRa2mdpostMapg, 5433);
      sub_528F00((int)aRandommap, (int)aDescription, v3, (wchar_t *)(this + 120), 0x80u);
      v4 = sub_5276D0(aRandommap, aWidth, *(_DWORD *)(this + 100));
      v5 = *(_DWORD *)(this + 104);
      *(_DWORD *)(this + 100) = v4;
      v6 = sub_5276D0(aRandommap, aHeight, v5);
      v20 = *(_DWORD *)(this + 80);
      *(_DWORD *)(this + 104) = v6;
      *(_DWORD *)(this + 80) = sub_5276D0(aRandommap, aNumplayers, v20);
      v7 = sub_5276D0(aRandommap, aSeed, *(_DWORD *)(this + 116));
      v8 = *(_DWORD *)(this + 60);
      *(_DWORD *)(this + 116) = v7;
      v9 = sub_5276D0(aRandommap, aMaptype, v8);
      v21 = *(_DWORD *)(this + 56);
      *(_DWORD *)(this + 60) = v9;
      *(_DWORD *)(this + 56) = sub_5276D0(aRandommap, aTheater, v21);
      v10 = sub_5276D0(aRandommap, aTime_0, *(_DWORD *)(this + 72));
      v11 = *(_DWORD *)(this + 112);
      *(_DWORD *)(this + 72) = v10;
      v12 = sub_5276D0(aRandommap, aRegionsize, v11);
      v22 = *(_DWORD *)(this + 68);
      *(_DWORD *)(this + 112) = v12;
      *(_DWORD *)(this + 68) = sub_5276D0(aRandommap, aRuggedness, v22);
      v13 = sub_5276D0(aRandommap, aAccessibility, *(_DWORD *)(this + 108));
      v14 = *(_DWORD *)(this + 76);
      *(_DWORD *)(this + 108) = v13;
      v15 = sub_5276D0(aRandommap, aWateramount, v14);
      v23 = *(_DWORD *)(this + 84);
      *(_DWORD *)(this + 76) = v15;
      *(_DWORD *)(this + 84) = sub_5276D0(aRandommap, aTiberium, v23);
      v16 = sub_5276D0(aRandommap, aTiberiumlayout, *(_DWORD *)(this + 88));
      v17 = *(_DWORD *)(this + 92);
      *(_DWORD *)(this + 88) = v16;
      v18 = sub_5276D0(aRandommap, aVegetation, v17);
      v24 = *(_DWORD *)(this + 96);
      *(_DWORD *)(this + 92) = v18;
      *(_DWORD *)(this + 96) = sub_5276D0(aRandommap, aUrbanpresence, v24);
      *(_DWORD *)(this + 64) = sub_5276D0(aRandommap, aResources, *(_DWORD *)(this + 64));
      sub_5256F0(v25);
      v30[0] = &CCFileClass::`vftable';
      v32 = 0;
      sub_43AE50(v31);
      v30[0] = &off_7E1668;
      sub_431B80(v30);
      return 1;
    }
    sub_5256F0(v25);
    v30[0] = &CCFileClass::`vftable';
    v32 = 0;
    sub_43AE50(v31);
    v30[0] = &off_7E1668;
    sub_431B80(v30);
  }
  return 0;
}
