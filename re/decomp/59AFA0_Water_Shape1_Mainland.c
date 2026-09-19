// 0x59afa0 Water_Shape1_Mainland size=25D

void __fastcall sub_59AFA0(_DWORD *a1)
{
  _DWORD *v1; // edi
  int v2; // eax
  double v3; // st7
  int v4; // ebx
  int i; // eax
  int v6; // eax
  int v7; // edi
  int j; // ecx
  __int64 v9; // rax
  int v10; // esi
  int v11; // [esp+10h] [ebp-48h]
  int v12; // [esp+14h] [ebp-44h]
  int v13; // [esp+18h] [ebp-40h]
  int v14; // [esp+1Ch] [ebp-3Ch] BYREF
  int v15; // [esp+20h] [ebp-38h]
  int v16; // [esp+24h] [ebp-34h]
  int v17; // [esp+28h] [ebp-30h] BYREF
  int v18; // [esp+2Ch] [ebp-2Ch]
  double v19; // [esp+30h] [ebp-28h]
  double v20; // [esp+38h] [ebp-20h]
  double v21; // [esp+40h] [ebp-18h]
  int v22[4]; // [esp+48h] [ebp-10h] BYREF

  v1 = a1;
  v15 = (int)a1;
  a1[194] = 1;
  v2 = sub_42B1F0();
  v3 = (double)(int)v1[19];
  v14 = v2;
  v12 = 0;
  v13 = 0;
  v19 = 0.0;
  v20 = (1.0 - v3 * 0.01) * (0.5 - 0.45) + 0.45;
  v21 = (double)v2;
  v16 = sub_7C5F00(v21 * 0.03 * v20);
  v4 = dword_87F8E0 / 2 + dword_87F8DC / 2;
  v18 = v4;
  v17 = v4 + 1;
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
  {
    v14 = *(_DWORD *)(i + 36);
    *((_DWORD *)dword_ABED10 + 20 * (__int16)v14 + 20 * dword_89C2DC * SHIWORD(v14) + 15) = 0;
  }
  v22[0] = dword_87F8E4 + 1;
  v22[1] = dword_87F8E8 + 1;
  v22[2] = dword_87F8EC - 2;
  v22[3] = dword_87F8F0 - 2;
  if ( v20 > 0.0 )
  {
    while ( v13 < 100 )
    {
      v6 = sub_7C5F00((v20 - v19) * v21);
      if ( v6 >= v16 )
        v6 = v16;
      LOWORD(v14) = v4 + 1;
      HIWORD(v14) = v4;
      v12 += sub_59BBC0(v1, v6, v22, (int)&v17, 1, (int)&v14, 0.75, 1);
      ++v13;
      v7 = 50000;
      v11 = 0;
      v19 = (double)v12 / v21;
      sub_578350(&stru_87F7E8);
      for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
      {
        if ( *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(j + 36) + 20 * dword_89C2DC * *(__int16 *)(j + 38) + 15) == 0 )
        {
          v9 = *(__int16 *)(j + 36) - (v4 + 1);
          v10 = (HIDWORD(v9) ^ v9) - HIDWORD(v9) + abs32(*(__int16 *)(j + 38) - v4);
          if ( v10 < v7 )
          {
            v7 = v10;
            v11 = *(_DWORD *)(j + 36);
          }
        }
      }
      v17 = (__int16)v11;
      v18 = SHIWORD(v11);
      if ( v19 >= v20 )
        break;
      v1 = (_DWORD *)v15;
    }
  }
}
